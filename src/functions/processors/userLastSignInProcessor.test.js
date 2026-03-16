function setupProcessor() {
  jest.resetModules();

  jest.doMock('../lib/logging', () => ({
    error: jest.fn(),
  }));

  jest.doMock('../lib/provider', () => ({
    apiGet: jest.fn(),
    apiPatch: jest.fn(),
  }));

  jest.doMock('../lib/graphClient', () => ({
    apiConfigWithSite: {
      uri: 'https://test.sharepoint.com/sites/test/',
    },
    apiConfig: {
      uri: 'https://graph.test/v1.0/',
    },
  }));

  jest.doMock('../lib/helpers/mappingHelper', () => ({
    initialize: jest.fn(),
  }));

  jest.doMock('../lib/helpers/tagHelper', () => ({
    initialize: jest.fn(),
  }));

  const processor = require('./userLastSignInProcessor');
  const logging = require('../lib/logging');
  const { apiGet, apiPatch } = require('../lib/provider');
  const mappingHelper = require('../lib/helpers/mappingHelper');
  const tagHelper = require('../lib/helpers/tagHelper');

  return {
    processor,
    logging,
    apiGet,
    apiPatch,
    mappingHelper,
    tagHelper,
  };
}

describe('userLastSignInProcessor', () => {
  test('updates users with newer sign-in dates across paginated responses', async () => {
    const { processor, apiGet, apiPatch, mappingHelper, tagHelper } = setupProcessor();

    const config = { UserListId: 'user-list-id' };

    apiGet.mockImplementation((url) => {
      if (url.includes('lists/user-list-id/items')) {
        if (url.includes('page=2')) {
          return Promise.resolve({
            success: true,
            data: {
              value: [
                {
                  fields: {
                    id: '2',
                    ADUserId: 'u2',
                    LastSignInDate: '2024-01-01T00:00:00.000Z',
                    Title: 'Second User',
                    Country: 'DE',
                    Email: 'two@example.com',
                  },
                },
              ],
            },
          });
        }

        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                fields: {
                  id: '1',
                  ADUserId: 'u1',
                  LastSignInDate: '2024-01-01T00:00:00.000Z',
                  Title: 'First User',
                  Country: 'RO',
                  Email: 'one@example.com',
                },
              },
            ],
            '@odata.nextLink': 'https://next/users?page=2',
          },
        });
      }

      if (url.includes('users?select=id,displayName,signInActivity')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                id: 'u1',
                signInActivity: {
                  lastSignInDateTime: '2025-01-02T00:00:00.000Z',
                },
              },
              {
                id: 'u2',
                signInActivity: {
                  lastSignInDateTime: '2023-01-01T00:00:00.000Z',
                },
              },
            ],
          },
        });
      }

      return Promise.resolve({ success: true, data: { value: [] } });
    });

    apiPatch.mockResolvedValue({ success: true });
    mappingHelper.initialize.mockResolvedValue();
    tagHelper.initialize.mockResolvedValue();

    const result = await processor.processUserLastSignIn(config);

    expect(result).toBeUndefined();
    expect(mappingHelper.initialize).toHaveBeenCalledWith(config);
    expect(tagHelper.initialize).toHaveBeenCalledWith('UserLastSignIn', config);
    expect(apiPatch).toHaveBeenCalledTimes(1);
    expect(apiPatch).toHaveBeenCalledWith(
      'https://test.sharepoint.com/sites/test/lists/user-list-id/items/1',
      {
        fields: {
          LastSignInDate: new Date('2025-01-02T00:00:00.000Z'),
        },
      },
    );
  });

  test('logs and skips users without sign-in activity', async () => {
    const { processor, apiGet, apiPatch, mappingHelper, tagHelper } = setupProcessor();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    apiGet.mockImplementation((url) => {
      if (url.includes('lists/user-list-id/items')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                fields: {
                  id: '1',
                  ADUserId: 'u1',
                  Title: 'Test User',
                  Email: 'test@example.com',
                },
              },
            ],
          },
        });
      }

      return Promise.resolve({
        success: true,
        data: {
          value: [{ id: 'u1' }],
        },
      });
    });

    apiPatch.mockResolvedValue({ success: true });
    mappingHelper.initialize.mockResolvedValue();
    tagHelper.initialize.mockResolvedValue();

    await processor.processUserLastSignIn({ UserListId: 'user-list-id' });

    expect(apiPatch).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      'User Test User - test@example.com has no sign in activity.',
    );

    logSpy.mockRestore();
  });

  test('stops loading when upstream endpoints return unsuccessful responses', async () => {
    const { processor, apiGet, apiPatch, mappingHelper, tagHelper } = setupProcessor();

    apiGet.mockResolvedValue({ success: false });
    apiPatch.mockResolvedValue({ success: true });
    mappingHelper.initialize.mockResolvedValue();
    tagHelper.initialize.mockResolvedValue();

    const result = await processor.processUserLastSignIn({ UserListId: 'user-list-id' });

    expect(result).toBeUndefined();
    expect(apiPatch).not.toHaveBeenCalled();
  });

  test('continues processing when patch call fails for a user', async () => {
    const { processor, apiGet, apiPatch, mappingHelper, tagHelper } = setupProcessor();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    apiGet.mockImplementation((url) => {
      if (url.includes('lists/user-list-id/items')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                fields: {
                  id: '1',
                  ADUserId: 'u1',
                  LastSignInDate: '2022-01-01T00:00:00.000Z',
                  Title: 'Patch User',
                  Country: 'RO',
                  Email: 'patch@example.com',
                },
              },
            ],
          },
        });
      }

      return Promise.resolve({
        success: true,
        data: {
          value: [
            {
              id: 'u1',
              signInActivity: {
                lastSignInDateTime: '2025-01-01T00:00:00.000Z',
              },
            },
          ],
        },
      });
    });

    apiPatch.mockRejectedValue(new Error('Patch failed'));
    mappingHelper.initialize.mockResolvedValue();
    tagHelper.initialize.mockResolvedValue();

    const result = await processor.processUserLastSignIn({ UserListId: 'user-list-id' });

    expect(result).toBeUndefined();
    expect(apiPatch).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalled();

    logSpy.mockRestore();
  });

  test('returns error when initialization fails', async () => {
    const { processor, logging, mappingHelper } = setupProcessor();
    const config = { UserListId: 'user-list-id' };
    const error = new Error('Initialization failed');

    mappingHelper.initialize.mockRejectedValue(error);

    const result = await processor.processUserLastSignIn(config);

    expect(result).toBe(error);
    expect(logging.error).toHaveBeenCalledWith(config, error, 'UserLastSignIn');
  });
});
