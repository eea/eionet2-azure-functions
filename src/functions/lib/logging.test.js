function setupLogging() {
  jest.resetModules();

  jest.doMock('./graphClient', () => ({
    getAccessToken: jest.fn().mockResolvedValue('token'),
    apiConfigWithSite: { uri: 'https://test.sharepoint.com/sites/test/' },
  }));

  const post = jest.fn().mockResolvedValue({ data: { id: 'log-1' } });
  jest.doMock('axios', () => ({ default: { post } }));

  const logging = require('./logging');
  return { logging, post };
}

describe('logging suppression', () => {
  test('info posts when no suppression list is configured', async () => {
    const { logging, post } = setupLogging();
    const config = { LoggingListId: 'list-id' };

    const result = await logging.info(config, 'hello', '/api', {}, 'MeetingFields');

    expect(post).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.suppressed).toBeUndefined();
  });

  test('info suppresses POST when job is in LoggingDisabledInfoJobs', async () => {
    const { logging, post } = setupLogging();
    const config = {
      LoggingListId: 'list-id',
      LoggingDisabledInfoJobs: 'MeetingFields, UserSignInNames',
    };

    const result = await logging.info(config, 'hello', '/api', {}, 'MeetingFields');

    expect(post).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, suppressed: true });
  });

  test('info is unaffected by LoggingDisabledErrorJobs', async () => {
    const { logging, post } = setupLogging();
    const config = {
      LoggingListId: 'list-id',
      LoggingDisabledErrorJobs: 'MeetingFields',
    };

    await logging.info(config, 'hello', '/api', {}, 'MeetingFields');

    expect(post).toHaveBeenCalledTimes(1);
  });

  test('error suppresses POST when job is in LoggingDisabledErrorJobs', async () => {
    const { logging, post } = setupLogging();
    const config = {
      LoggingListId: 'list-id',
      LoggingDisabledErrorJobs: 'MeetingFields',
    };

    const result = await logging.error(config, new Error('boom'), 'MeetingFields');

    expect(post).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, suppressed: true });
  });

  test('error is unaffected by LoggingDisabledInfoJobs', async () => {
    const { logging, post } = setupLogging();
    const config = {
      LoggingListId: 'list-id',
      LoggingDisabledInfoJobs: 'MeetingFields',
    };

    await logging.error(config, new Error('boom'), 'MeetingFields');

    expect(post).toHaveBeenCalledTimes(1);
  });

  test('suppression list with whitespace and empty entries is tolerated', async () => {
    const { logging, post } = setupLogging();
    const config = {
      LoggingListId: 'list-id',
      LoggingDisabledInfoJobs: ' , MeetingFields , ,UserSignInNames',
    };

    await logging.info(config, 'hi', '/api', {}, 'MeetingFields');
    await logging.info(config, 'hi', '/api', {}, 'UserSignInNames');
    await logging.info(config, 'hi', '/api', {}, 'LoggingCleanup');

    expect(post).toHaveBeenCalledTimes(1);
  });

  test('non-matching job is not suppressed', async () => {
    const { logging, post } = setupLogging();
    const config = {
      LoggingListId: 'list-id',
      LoggingDisabledInfoJobs: 'MeetingFields',
    };

    await logging.info(config, 'hi', '/api', {}, 'UserRemoval');

    expect(post).toHaveBeenCalledTimes(1);
  });

  test('falls back to default job name for suppression matching', async () => {
    const { logging, post } = setupLogging();
    const config = {
      LoggingListId: 'list-id',
      LoggingDisabledInfoJobs: 'Eionet2-Azure-Jobs',
    };

    const result = await logging.info(config, 'hi', '/api', {});

    expect(post).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, suppressed: true });
  });
});

describe('logging priority', () => {
  test('info always writes Priority=Low', async () => {
    const { logging, post } = setupLogging();
    await logging.info({ LoggingListId: 'list-id' }, 'hi', '/api', {}, 'MeetingFields');
    expect(post.mock.calls[0][1].fields.Priority).toBe('Low');
  });

  test('error defaults Priority to Normal', async () => {
    const { logging, post } = setupLogging();
    await logging.error({ LoggingListId: 'list-id' }, new Error('boom'), 'MeetingFields');
    expect(post.mock.calls[0][1].fields.Priority).toBe('Normal');
  });

  test('error accepts explicit High priority', async () => {
    const { logging, post } = setupLogging();
    await logging.error(
      { LoggingListId: 'list-id' },
      new Error('boom'),
      'MeetingFields',
      undefined,
      undefined,
      logging.PRIORITY.HIGH,
    );
    expect(post.mock.calls[0][1].fields.Priority).toBe('High');
  });

  test('PRIORITY constants are exposed and frozen', () => {
    const { logging } = setupLogging();
    expect(logging.PRIORITY).toEqual({ HIGH: 'High', NORMAL: 'Normal', LOW: 'Low' });
    expect(Object.isFrozen(logging.PRIORITY)).toBe(true);
  });
});

describe('logging ApiData', () => {
  test('info writes empty ApiData for an empty object instead of "{}"', async () => {
    const { logging, post } = setupLogging();
    await logging.info({ LoggingListId: 'list-id' }, 'hi', '/api', {}, 'MeetingFields');
    expect(post.mock.calls[0][1].fields.ApiData).toBe('');
  });

  test('info writes empty ApiData when data is omitted', async () => {
    const { logging, post } = setupLogging();
    await logging.info({ LoggingListId: 'list-id' }, 'hi', '/api', undefined, 'MeetingFields');
    expect(post.mock.calls[0][1].fields.ApiData).toBe('');
  });

  test('info serializes non-empty data', async () => {
    const { logging, post } = setupLogging();
    await logging.info({ LoggingListId: 'list-id' }, 'hi', '/api', { a: 1 }, 'MeetingFields');
    expect(post.mock.calls[0][1].fields.ApiData).toBe('{"a":1}');
  });

  test('error writes empty ApiData for an Error with no enumerable properties', async () => {
    const { logging, post } = setupLogging();
    await logging.error({ LoggingListId: 'list-id' }, new Error('boom'), 'MeetingFields');
    expect(post.mock.calls[0][1].fields.ApiData).toBe('');
  });

  test('error does not write the bearer token of an axios error', async () => {
    const { logging, post } = setupLogging();
    const axiosError = {
      isAxiosError: true,
      message: 'Request failed with status code 404',
      config: {
        method: 'get',
        url: 'https://graph.test/users/1',
        headers: { Authorization: 'Bearer secret-token' },
      },
      response: { status: 404, data: { error: { message: 'Not found' } } },
    };

    await logging.error({ LoggingListId: 'list-id' }, axiosError, 'MeetingFields');

    const apiData = post.mock.calls[0][1].fields.ApiData;
    expect(apiData).not.toContain('secret-token');
    expect(apiData).not.toContain('Authorization');
    expect(JSON.parse(apiData)).toMatchObject({ status: 404, url: 'https://graph.test/users/1' });
  });
});

describe('logging warning', () => {
  test('warning writes Logtype=Warning and Priority=Low', async () => {
    const { logging, post } = setupLogging();
    await logging.warning({ LoggingListId: 'list-id' }, 'heads up', '', '', 'UpdateSignedInUsers');
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1].fields.Logtype).toBe('Warning');
    expect(post.mock.calls[0][1].fields.Priority).toBe('Low');
  });

  test('warning is suppressed when job is in LoggingDisabledWarningJobs', async () => {
    const { logging, post } = setupLogging();
    const config = {
      LoggingListId: 'list-id',
      LoggingDisabledWarningJobs: 'UpdateSignedInUsers',
    };

    const result = await logging.warning(config, 'heads up', '', '', 'UpdateSignedInUsers');

    expect(post).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, suppressed: true });
  });

  test('warning is unaffected by the Info suppression list', async () => {
    const { logging, post } = setupLogging();
    const config = {
      LoggingListId: 'list-id',
      LoggingDisabledInfoJobs: 'UpdateSignedInUsers',
    };

    await logging.warning(config, 'heads up', '', '', 'UpdateSignedInUsers');

    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe('logging error title', () => {
  test('appends HTTP status and endpoint for an axios error', async () => {
    const { logging, post } = setupLogging();
    const axiosError = {
      toString: () => 'Error: Request failed with status code 404',
      response: { status: 404 },
      config: { url: 'https://graph.test/users/1/onlineMeetings?$filter=x' },
    };

    await logging.error({ LoggingListId: 'list-id' }, axiosError, 'UpdateMeetingParticipants');

    expect(post.mock.calls[0][1].fields.Title).toBe(
      'Error: Request failed with status code 404 (HTTP 404 on https://graph.test/users/1/onlineMeetings)',
    );
  });

  test('appends HTTP info to an explicit message', async () => {
    const { logging, post } = setupLogging();
    const axiosError = {
      toString: () => 'Error',
      response: { status: 400 },
      config: { url: 'https://graph.test/teams/1/tags' },
    };

    await logging.error(
      { LoggingListId: 'list-id' },
      axiosError,
      'UserMembershipUpdates',
      'Applying the tag failed',
    );

    expect(post.mock.calls[0][1].fields.Title).toBe(
      'Applying the tag failed (HTTP 400 on https://graph.test/teams/1/tags)',
    );
  });

  test('does not throw and uses the message when the error is nullish', async () => {
    const { logging, post } = setupLogging();

    await logging.error(
      { LoggingListId: 'list-id' },
      undefined,
      'UserMembershipUpdates',
      'Applying the tag failed',
    );

    expect(post.mock.calls[0][1].fields.Title).toBe('Applying the tag failed');
    expect(post.mock.calls[0][1].fields.ApiData).toBe('');
  });
});

describe('logging LOG_TYPE', () => {
  test('LOG_TYPE constants are exposed and frozen', () => {
    const { logging } = setupLogging();
    expect(logging.LOG_TYPE).toEqual({ INFO: 'Info', WARNING: 'Warning', ERROR: 'Error' });
    expect(Object.isFrozen(logging.LOG_TYPE)).toBe(true);
  });
});
