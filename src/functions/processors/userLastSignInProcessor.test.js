const processor = require('./userLastSignInProcessor');

// Mock all dependencies
jest.mock('../lib/logging', () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

jest.mock('../lib/provider', () => ({
  apiGet: jest.fn(),
  apiPatch: jest.fn(),
  apiPost: jest.fn(),
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
  getUserByMail: jest.fn(),
}));

// Get the mocked functions
const { apiGet } = require('../lib/provider');

describe('userLastSignInProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('basic test', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    apiGet.mockImplementation(() =>
      Promise.resolve({
        success: true,
        data: { value: [] },
      }),
    );

    const result = await processor.processUserLastSignIn(mockConfig);
    expect(result).toBeUndefined();
  });
});
