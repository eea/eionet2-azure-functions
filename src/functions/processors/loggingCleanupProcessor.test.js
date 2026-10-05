function setupProcessor() {
  jest.resetModules();

  jest.doMock('../lib/logging', () => ({
    PRIORITY: { HIGH: 'High', NORMAL: 'Normal', LOW: 'Low' },
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  }));

  jest.doMock('../lib/provider', () => ({
    apiGet: jest.fn(),
    apiPost: jest.fn(),
    apiDelete: jest.fn(),
  }));

  jest.doMock('../lib/graphClient', () => ({
    apiConfigWithSite: {
      uri: 'https://test.sharepoint.com/sites/test/',
    },
  }));

  const processor = require('./loggingCleanupProcessor');
  const logging = require('../lib/logging');
  const { apiGet, apiPost, apiDelete } = require('../lib/provider');

  return { processor, logging, apiGet, apiPost, apiDelete };
}

describe('loggingCleanupProcessor', () => {
  const olderThanRetention = new Date();
  olderThanRetention.setMonth(olderThanRetention.getMonth() - 7);

  const evenOlder = new Date();
  evenOlder.setFullYear(evenOlder.getFullYear() - 5);

  const recent = new Date();
  recent.setMonth(recent.getMonth() - 1);

  const mockConfig = {
    LoggingListId: 'logging-list-id',
    ArchiveLoggingListId: 'archive-list-id',
  };
  const mockContext = { log: jest.fn() };

  test('archives and deletes only records older than the retention period', async () => {
    const { processor, logging, apiGet, apiPost, apiDelete } = setupProcessor();

    apiGet.mockResolvedValue({
      success: true,
      data: {
        value: [
          { id: '1', fields: { Timestamp: olderThanRetention.toISOString() } },
          { id: '2', fields: { Timestamp: recent.toISOString() } },
          { id: '3', fields: { Timestamp: olderThanRetention.toISOString() } },
        ],
      },
    });
    apiPost.mockResolvedValue({ success: true });
    apiDelete.mockResolvedValue({ success: true });

    const result = await processor.processLoggingCleanup(mockConfig, mockContext);

    expect(apiPost).toHaveBeenCalledTimes(2);
    expect(apiPost).toHaveBeenCalledWith(
      'https://test.sharepoint.com/sites/test/lists/archive-list-id/items',
      { fields: { Timestamp: olderThanRetention.toISOString() } },
    );
    expect(apiDelete).toHaveBeenCalledTimes(2);
    expect(apiDelete).toHaveBeenCalledWith(
      'https://test.sharepoint.com/sites/test/lists/logging-list-id/items/1',
    );
    expect(apiDelete).toHaveBeenCalledWith(
      'https://test.sharepoint.com/sites/test/lists/logging-list-id/items/3',
    );
    expect(logging.warning).not.toHaveBeenCalled();
    expect(result).toEqual({
      scanned: 3,
      eligible: 2,
      archived: 2,
      deleted: 2,
      failed: 0,
      remaining: 0,
    });
  });

  test('copies the logging columns to the archive list and drops the read only ones', async () => {
    const { processor, apiGet, apiPost, apiDelete } = setupProcessor();

    apiGet.mockResolvedValue({
      success: true,
      data: {
        value: [
          {
            id: '1',
            fields: {
              '@odata.etag': '"1"',
              id: '1',
              ContentType: 'Item',
              Created: '2020-01-01T00:00:00Z',
              Modified: '2020-01-01T00:00:00Z',
              AuthorLookupId: '7',
              Title: 'MeetingFields - something happened',
              ApplicationName: 'MeetingFields',
              ApiPath: '/api/path',
              ApiData: '{"a":1}',
              Logtype: 'Error',
              Priority: 'Normal',
              Timestamp: olderThanRetention.toISOString(),
              Action: 'Update',
              AffectedUser: 'user@test.com',
            },
          },
        ],
      },
    });
    apiPost.mockResolvedValue({ success: true });
    apiDelete.mockResolvedValue({ success: true });

    await processor.processLoggingCleanup(mockConfig, mockContext);

    expect(apiPost).toHaveBeenCalledWith(
      'https://test.sharepoint.com/sites/test/lists/archive-list-id/items',
      {
        fields: {
          Title: 'MeetingFields - something happened',
          ApplicationName: 'MeetingFields',
          ApiPath: '/api/path',
          ApiData: '{"a":1}',
          Logtype: 'Error',
          Priority: 'Normal',
          Timestamp: olderThanRetention.toISOString(),
          Action: 'Update',
          AffectedUser: 'user@test.com',
        },
      },
    );
  });

  test('does not delete a record whose archiving failed', async () => {
    const { processor, logging, apiGet, apiPost, apiDelete } = setupProcessor();

    apiGet.mockResolvedValue({
      success: true,
      data: {
        value: [
          { id: '1', fields: { Timestamp: evenOlder.toISOString() } },
          { id: '2', fields: { Timestamp: olderThanRetention.toISOString() } },
        ],
      },
    });
    apiPost
      .mockResolvedValueOnce({ success: false, error: new Error('archive full') })
      .mockResolvedValueOnce({ success: true });
    apiDelete.mockResolvedValue({ success: true });

    const result = await processor.processLoggingCleanup(mockConfig, mockContext);

    expect(apiDelete).toHaveBeenCalledTimes(1);
    expect(apiDelete).toHaveBeenCalledWith(
      'https://test.sharepoint.com/sites/test/lists/logging-list-id/items/2',
    );
    expect(result).toEqual({
      scanned: 2,
      eligible: 2,
      archived: 1,
      deleted: 1,
      failed: 1,
      remaining: 1,
    });
    expect(logging.warning).toHaveBeenCalledWith(
      mockConfig,
      expect.stringContaining('1 failed'),
      undefined,
      { archived: 1, deleted: 1, failed: 1, remaining: 1, firstError: 'archive full' },
      'LoggingCleanup',
    );
  });

  test('fails the job when the archive list is not configured', async () => {
    const { processor, logging, apiGet, apiPost, apiDelete } = setupProcessor();

    const result = await processor.processLoggingCleanup(
      { LoggingListId: 'logging-list-id' },
      mockContext,
    );

    expect(apiGet).not.toHaveBeenCalled();
    expect(apiPost).not.toHaveBeenCalled();
    expect(apiDelete).not.toHaveBeenCalled();
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toContain('ArchiveLoggingListId');
    expect(logging.error).toHaveBeenCalledWith(
      { LoggingListId: 'logging-list-id' },
      result,
      'LoggingCleanup',
      undefined,
      undefined,
      logging.PRIORITY.HIGH,
    );
  });

  test('skips records with missing Timestamp', async () => {
    const { processor, apiGet, apiPost, apiDelete } = setupProcessor();

    apiGet.mockResolvedValue({
      success: true,
      data: {
        value: [
          { id: '1', fields: {} },
          { id: '2', fields: { Timestamp: null } },
        ],
      },
    });

    const result = await processor.processLoggingCleanup(mockConfig, mockContext);

    expect(apiPost).not.toHaveBeenCalled();
    expect(apiDelete).not.toHaveBeenCalled();
    expect(result).toEqual({
      scanned: 2,
      eligible: 0,
      archived: 0,
      deleted: 0,
      failed: 0,
      remaining: 0,
    });
  });

  test('counts only successful deletes and reports the failure', async () => {
    const { processor, logging, apiGet, apiPost, apiDelete } = setupProcessor();

    apiGet.mockResolvedValue({
      success: true,
      data: {
        value: [
          { id: '1', fields: { Timestamp: olderThanRetention.toISOString() } },
          { id: '2', fields: { Timestamp: olderThanRetention.toISOString() } },
        ],
      },
    });
    apiPost.mockResolvedValue({ success: true });
    apiDelete
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: new Error('boom') });

    const result = await processor.processLoggingCleanup(mockConfig, mockContext);

    expect(result).toEqual({
      scanned: 2,
      eligible: 2,
      archived: 2,
      deleted: 1,
      failed: 1,
      remaining: 1,
    });
    expect(logging.warning).toHaveBeenCalledWith(
      mockConfig,
      expect.stringContaining('1 failed'),
      undefined,
      { archived: 2, deleted: 1, failed: 1, remaining: 1, firstError: 'boom' },
      'LoggingCleanup',
    );
  });

  test('paginates through @odata.nextLink', async () => {
    const { processor, apiGet, apiPost, apiDelete } = setupProcessor();

    apiGet
      .mockResolvedValueOnce({
        success: true,
        data: {
          value: [{ id: '1', fields: { Timestamp: olderThanRetention.toISOString() } }],
          '@odata.nextLink': 'https://test.sharepoint.com/sites/test/page2',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          value: [{ id: '2', fields: { Timestamp: olderThanRetention.toISOString() } }],
        },
      });
    apiPost.mockResolvedValue({ success: true });
    apiDelete.mockResolvedValue({ success: true });

    const result = await processor.processLoggingCleanup(mockConfig, mockContext);

    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      scanned: 2,
      eligible: 2,
      archived: 2,
      deleted: 2,
      failed: 0,
      remaining: 0,
    });
  });

  test('moves every eligible record in one run, nothing is left behind', async () => {
    const { processor, logging, apiGet, apiPost, apiDelete } = setupProcessor();

    apiGet.mockResolvedValue({
      success: true,
      data: {
        value: [
          { id: '1', fields: { Timestamp: olderThanRetention.toISOString() } },
          { id: '2', fields: { Timestamp: olderThanRetention.toISOString() } },
          { id: '3', fields: { Timestamp: olderThanRetention.toISOString() } },
        ],
      },
    });
    apiPost.mockResolvedValue({ success: true });
    apiDelete.mockResolvedValue({ success: true });

    const result = await processor.processLoggingCleanup(mockConfig, mockContext);

    expect(apiPost).toHaveBeenCalledTimes(3);
    expect(apiDelete).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      scanned: 3,
      eligible: 3,
      archived: 3,
      deleted: 3,
      failed: 0,
      remaining: 0,
    });
    expect(logging.warning).not.toHaveBeenCalled();
  });

  test('reports the leftovers of a capped run as info, not as a warning', async () => {
    const { processor, logging, apiGet, apiPost, apiDelete } = setupProcessor();

    const eligible = processor.MAX_RECORDS_PER_RUN + 1;
    apiGet.mockResolvedValue({
      success: true,
      data: {
        value: Array.from({ length: eligible }, (unused, index) => ({
          id: `${index}`,
          fields: { Timestamp: olderThanRetention.toISOString() },
        })),
      },
    });
    apiPost.mockResolvedValue({ success: true });
    apiDelete.mockResolvedValue({ success: true });

    const result = await processor.processLoggingCleanup(mockConfig, mockContext);

    expect(result.deleted).toBe(processor.MAX_RECORDS_PER_RUN);
    expect(result.remaining).toBe(1);
    expect(logging.warning).not.toHaveBeenCalled();
    expect(logging.info).toHaveBeenCalledWith(
      mockConfig,
      expect.stringContaining('1 left for the next run'),
      undefined,
      {
        archived: processor.MAX_RECORDS_PER_RUN,
        deleted: processor.MAX_RECORDS_PER_RUN,
        remaining: 1,
      },
      'LoggingCleanup',
    );
  });

  test('moves the oldest records first', async () => {
    const { processor, apiGet, apiPost, apiDelete } = setupProcessor();

    apiGet.mockResolvedValue({
      success: true,
      data: {
        value: [
          { id: '1', fields: { Timestamp: olderThanRetention.toISOString() } },
          { id: '2', fields: { Timestamp: evenOlder.toISOString() } },
        ],
      },
    });
    apiPost.mockResolvedValue({ success: true });
    apiDelete.mockResolvedValue({ success: true });

    await processor.processLoggingCleanup(mockConfig, mockContext);

    expect(apiDelete.mock.calls.map((call) => call[0])).toEqual([
      'https://test.sharepoint.com/sites/test/lists/logging-list-id/items/2',
      'https://test.sharepoint.com/sites/test/lists/logging-list-id/items/1',
    ]);
  });

  test('does not archive or delete anything when a page of the scan fails', async () => {
    const { processor, logging, apiGet, apiPost, apiDelete } = setupProcessor();

    const err = new Error('throttled');
    apiGet
      .mockResolvedValueOnce({
        success: true,
        data: {
          value: [{ id: '1', fields: { Timestamp: olderThanRetention.toISOString() } }],
          '@odata.nextLink': 'https://test.sharepoint.com/sites/test/page2',
        },
      })
      .mockResolvedValueOnce({ success: false, error: err });

    const result = await processor.processLoggingCleanup(mockConfig, mockContext);

    expect(apiPost).not.toHaveBeenCalled();
    expect(apiDelete).not.toHaveBeenCalled();
    expect(result).toBe(err);
    expect(logging.error).toHaveBeenCalledWith(
      mockConfig,
      err,
      'LoggingCleanup',
      undefined,
      undefined,
      logging.PRIORITY.HIGH,
    );
  });

  test('logs and returns error on failure', async () => {
    const { processor, apiGet, logging } = setupProcessor();
    const err = new Error('graph down');
    apiGet.mockRejectedValue(err);

    const result = await processor.processLoggingCleanup(mockConfig, mockContext);

    expect(result).toBe(err);
    expect(logging.error).toHaveBeenCalledWith(
      mockConfig,
      err,
      'LoggingCleanup',
      undefined,
      undefined,
      logging.PRIORITY.HIGH,
    );
  });
});
