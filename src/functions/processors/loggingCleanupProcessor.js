const logging = require('../lib/logging'),
  { apiGet, apiPost, apiDelete } = require('../lib/provider'),
  { apiConfigWithSite } = require('../lib/graphClient'),
  jobName = 'LoggingCleanup',
  //Kept deliberately short so the Logging list stays under the SharePoint 5000 item
  //list view threshold, past which its queries start failing.
  RETENTION_MONTHS = 6,
  //Cap on how many records a single run moves. 0 means no cap: everything older than
  //RETENTION_MONTHS is processed, the run being bounded only by MAX_RUN_MINUTES.
  MAX_RECORDS_PER_RUN = 1000,
  //Columns copied to the archive list. The rest of what Graph returns under fields
  //(id, Created, Modified, Author/Editor, etag, ...) is read only and would make the
  //create call fail, so the copy is an explicit allow list of the Logging columns.
  ARCHIVED_COLUMNS = [
    'Title',
    'ApplicationName',
    'ApiPath',
    'ApiData',
    'Logtype',
    'Priority',
    'Timestamp',
    'Action',
    'AffectedUser',
  ],
  //Stop well before the host functionTimeout (see host.json) so the run can still
  //report what is left instead of being killed mid-loop without any summary.
  MAX_RUN_MINUTES = 90;

async function processLoggingCleanup(config, context) {
  try {
    if (!config.ArchiveLoggingListId) {
      throw new Error(
        'ArchiveLoggingListId is missing from the configuration list, no record was archived or removed.',
      );
    }

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS);

    const deadline = Date.now() + MAX_RUN_MINUTES * 60 * 1000;

    const logs = await loadLogs(config.LoggingListId);
    const stale = logs
      .filter((item) => {
        const timestamp = item.fields?.Timestamp;
        return timestamp && new Date(timestamp) < cutoffDate;
      })
      //Oldest first, so a capped run always drains the far end of the backlog.
      .sort((a, b) => new Date(a.fields.Timestamp) - new Date(b.fields.Timestamp));

    context.log(
      `Logging cleanup: ${stale.length} of ${logs.length} records older than ${cutoffDate.toISOString()} are eligible for archiving, ${MAX_RECORDS_PER_RUN ? `at most ${MAX_RECORDS_PER_RUN}` : 'all of them'} will be moved in this run.`,
    );

    let archived = 0,
      deleted = 0,
      failed = 0,
      firstError;
    for (const item of stale) {
      if (
        (MAX_RECORDS_PER_RUN && deleted + failed >= MAX_RECORDS_PER_RUN) ||
        Date.now() > deadline
      ) {
        break;
      }
      //Archive first: a record is only dropped from the Logging list once its copy
      //is safely in the archive list.
      const archiveResponse = await apiPost(
        `${apiConfigWithSite.uri}lists/${config.ArchiveLoggingListId}/items`,
        { fields: archivedFields(item.fields) },
      );
      if (!archiveResponse.success) {
        failed++;
        firstError = firstError ?? archiveResponse.error;
        continue;
      }
      archived++;

      const response = await apiDelete(
        `${apiConfigWithSite.uri}lists/${config.LoggingListId}/items/${item.id}`,
      );
      if (response.success) {
        deleted++;
      } else {
        failed++;
        firstError = firstError ?? response.error;
      }
    }

    const remaining = stale.length - deleted;
    context.log(
      `Logging cleanup: moved ${deleted} of ${stale.length} stale records to the archive list, ${archived - deleted} were archived but could not be removed, ${failed} failed, ${remaining} left for the next run.`,
    );

    if (failed) {
      await logging.warning(
        config,
        `cleanup incomplete: ${deleted} of ${stale.length} stale records moved to the archive list, ${failed} failed, ${remaining} remaining`,
        undefined,
        { archived, deleted, failed, remaining, firstError: firstError?.message },
        jobName,
      );
    } else if (remaining) {
      //Expected while the backlog is being drained one capped run at a time, so it is
      //reported as Info: a weekly Warning that always fires is noise.
      await logging.info(
        config,
        `cleanup capped: ${deleted} of ${stale.length} stale records moved to the archive list, ${remaining} left for the next run`,
        undefined,
        { archived, deleted, remaining },
        jobName,
      );
    }

    return { scanned: logs.length, eligible: stale.length, archived, deleted, failed, remaining };
  } catch (error) {
    await logging.error(config, error, jobName, undefined, undefined, logging.PRIORITY.HIGH);
    return error;
  }
}

function archivedFields(fields) {
  const copy = {};
  for (const column of ARCHIVED_COLUMNS) {
    if (fields[column] !== undefined && fields[column] !== null) {
      copy[column] = fields[column];
    }
  }
  return copy;
}

async function loadLogs(loggingListId) {
  let path = encodeURI(
      `${apiConfigWithSite.uri}lists/${loggingListId}/items?$expand=fields&$top=999`,
    ),
    result = [];

  while (path) {
    const response = await apiGet(path, true);
    //A failed page must not be swallowed: returning the pages collected so far would
    //make a partial scan look like a complete one and report a wrong eligible count.
    if (!response.success) {
      throw response.error;
    }
    result = result.concat(response.data.value);
    path = response.data['@odata.nextLink'];
  }
  return result;
}

module.exports = {
  processLoggingCleanup: processLoggingCleanup,
  RETENTION_MONTHS: RETENTION_MONTHS,
  MAX_RECORDS_PER_RUN: MAX_RECORDS_PER_RUN,
};
