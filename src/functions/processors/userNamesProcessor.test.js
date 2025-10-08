const processor = require('./userNamesProcessor');

// Mock all dependencies
jest.mock('../lib/logging', () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

jest.mock('../lib/provider', () => ({
  apiGet: jest.fn(),
  apiPatch: jest.fn(),
}));

jest.mock('../lib/graphClient', () => ({
  apiConfigWithSite: {
    uri: 'https://test.sharepoint.com/sites/test/',
  },
  apiConfig: {
    uri: 'https://test.sharepoint.com/sites/test/',
  },
}));

jest.mock('../lib/helpers/userHelper', () => ({
  getADUser: jest.fn(),
}));

// Get the mocked functions
const { apiGet, apiPatch } = require('../lib/provider');
const userHelper = require('../lib/helpers/userHelper');

describe('userNamesProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('processUsers', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    apiGet.mockImplementation((url) => {
      if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                fields: {
                  id: '36',
                  Title: 'REAL Ionel Ganea',
                  Country: 'RO',
                  ADUserId: 'ae40523c-d750-41f5-9873-6346b474e5fb',
                },
              },
            ],
          },
        });
      }
      return Promise.resolve({ success: false, data: null });
    });

    apiPatch.mockImplementation(() =>
      Promise.resolve({
        success: true,
        data: { id: 'user-id' },
      }),
    );

    userHelper.getADUser.mockResolvedValue({
      id: 'ae40523c-d750-41f5-9873-6346b474e5fb',
      displayName: 'REAL Ionel Ganea',
    });

    const result = await processor.processUsers(mockConfig);
    expect(result).toBeUndefined();
  });

  test('processUsers with NFP', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    apiGet.mockImplementation((url) => {
      if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                fields: {
                  id: '36',
                  Title: 'REAL Ionel Ganea',
                  Country: 'RO',
                  Email: 'toyet68222@sartess.com',
                  ADUserId: 'ae40523c-d750-41f5-9873-6346b474e5fb',
                  NFP: 'NFP',
                },
              },
            ],
          },
        });
      }
      return Promise.resolve({ success: false, data: null });
    });

    apiPatch.mockImplementation(() =>
      Promise.resolve({
        success: true,
        data: { id: 'user-id' },
      }),
    );

    userHelper.getADUser.mockResolvedValue({
      id: 'ae40523c-d750-41f5-9873-6346b474e5fb',
      displayName: 'REAL Ionel Ganea',
    });

    const result = await processor.processUsers(mockConfig);
    expect(result).toBeUndefined();
  });

  test('processUsers with AD country', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    apiGet.mockImplementation((url) => {
      if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                fields: {
                  id: '36',
                  Title: 'REAL Ionel Ganea',
                  Country: 'RO',
                  Email: 'toyet68222@sartess.com',
                  ADUserId: 'ae40523c-d750-41f5-9873-6346b474e5fb',
                  NFP: 'NFP',
                },
              },
            ],
          },
        });
      }
      return Promise.resolve({ success: false, data: null });
    });

    apiPatch.mockImplementation(() =>
      Promise.resolve({
        success: true,
        data: { id: 'user-id' },
      }),
    );

    userHelper.getADUser.mockResolvedValue({
      id: 'ae40523c-d750-41f5-9873-6346b474e5fb',
      displayName: 'REAL Ionel Ganea',
      country: 'MK',
    });

    const result = await processor.processUsers(mockConfig);
    expect(result).toBeUndefined();
  });
});
