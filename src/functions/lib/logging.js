const axios = require('axios'),
  { getAccessToken, apiConfigWithSite } = require('./graphClient'),
  { sanitizeError } = require('./helpers/utils');

const LOG_TYPE = Object.freeze({
  INFO: 'Info',
  WARNING: 'Warning',
  ERROR: 'Error',
});

const PRIORITY = Object.freeze({
  HIGH: 'High',
  NORMAL: 'Normal',
  LOW: 'Low',
});

//Serialize a value for the ApiData column, avoiding a useless "{}" entry
//(e.g. an empty payload or an Error object with no enumerable properties).
function serializeApiData(value) {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  const json = JSON.stringify(value);
  return json === '{}' ? '' : json;
}

//Build a concise "HTTP <status> on <endpoint>" descriptor from an axios error
//so 400/404 failures on different endpoints (tags, users, groups, meetings)
//can be told apart in the Logging list. Returns undefined for non-HTTP errors.
function describeHttpError(err) {
  const status = err?.response?.status;
  if (!status) {
    return undefined;
  }
  const url = err?.config?.url;
  const endpoint = url ? url.split('?')[0] : undefined;
  return endpoint ? `HTTP ${status} on ${endpoint}` : `HTTP ${status}`;
}

function isJobSuppressed(configuration, jobName, configKey) {
  const raw = configuration?.[configKey];
  if (!raw) return false;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(jobName);
}

async function writeEntry(configuration, jobTitle, suppressionKey, entryFields) {
  if (isJobSuppressed(configuration, jobTitle, suppressionKey)) {
    return { success: true, suppressed: true };
  }
  const token = await getAccessToken();
  const options = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
  const path = apiConfigWithSite.uri + 'lists/' + configuration.LoggingListId + '/items';
  try {
    const response = await axios.default.post(path, { fields: entryFields }, options);
    return { success: true, data: response.data };
  } catch (err) {
    console.log(sanitizeError(err));
    return { success: false, error: err };
  }
}

async function info(configuration, message, apiPath, data, jobName, action, affectedUser) {
  console.log(message);
  const jobTitle = jobName || 'Eionet2-Azure-Jobs';
  return writeEntry(configuration, jobTitle, 'LoggingDisabledInfoJobs', {
    ApplicationName: jobTitle,
    ApiPath: apiPath,
    ApiData: serializeApiData(data),
    Title: jobTitle + ' - ' + message,
    Logtype: LOG_TYPE.INFO,
    Priority: PRIORITY.LOW,
    Timestamp: new Date(),
    Action: action,
    AffectedUser: affectedUser,
  });
}

async function error(
  configuration,
  error,
  jobName,
  message,
  affectedUser,
  priority = PRIORITY.NORMAL,
) {
  const safeError = sanitizeError(error);
  console.log(safeError);
  const jobTitle = jobName || 'Eionet2-Azure-Jobs';

  let innerMessage = message;
  //missing index error
  if (error?.response?.data?.message?.includes('HonorNonIndexedQueriesWarningMayFailRandomly')) {
    innerMessage = error.response.data.message;
  }

  let title = innerMessage ?? error?.toString() ?? 'Unknown error';
  const httpInfo = describeHttpError(error);
  if (httpInfo) {
    title = `${title} (${httpInfo})`;
  }

  return writeEntry(configuration, jobTitle, 'LoggingDisabledErrorJobs', {
    ApplicationName: jobTitle,
    ApiData: serializeApiData(safeError),
    Title: title,
    Logtype: LOG_TYPE.ERROR,
    Priority: priority,
    Timestamp: new Date(),
    AffectedUser: affectedUser,
  });
}

async function warning(configuration, message, apiPath, data, jobName, action, affectedUser) {
  console.log(message);
  const jobTitle = jobName || 'Eionet2-Azure-Jobs';
  return writeEntry(configuration, jobTitle, 'LoggingDisabledWarningJobs', {
    ApplicationName: jobTitle,
    ApiPath: apiPath,
    ApiData: serializeApiData(data),
    Title: jobTitle + ' - ' + message,
    Logtype: LOG_TYPE.WARNING,
    Priority: PRIORITY.LOW,
    Timestamp: new Date(),
    Action: action,
    AffectedUser: affectedUser,
  });
}

module.exports = {
  info: info,
  warning: warning,
  error: error,
  LOG_TYPE: LOG_TYPE,
  PRIORITY: PRIORITY,
};
