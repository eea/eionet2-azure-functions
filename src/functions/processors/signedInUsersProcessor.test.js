const processor = require('./signedInUsersProcessor');

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

jest.mock('../lib/helpers/mappingHelper', () => ({
  initialize: jest.fn(),
  getMappings: jest.fn(),
}));

jest.mock('../lib/helpers/tagHelper', () => ({
  initialize: jest.fn(),
  applyTags: jest.fn(),
}));

// Get the mocked functions
const { apiGet, apiPatch } = require('../lib/provider');
const userHelper = require('../lib/helpers/userHelper');
const mappingHelper = require('../lib/helpers/mappingHelper');
const tagHelper = require('../lib/helpers/tagHelper');

describe('signedInUsersProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should process signed in users successfully with empty data', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    apiGet.mockImplementation(() =>
      Promise.resolve({
        success: true,
        data: { value: [] },
      }),
    );

    const result = await processor.processSignedInUsers(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should process users with sign-in data', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    const mockUsers = [
      {
        id: '1',
        fields: {
          Title: 'Test User',
          ADUserId: 'user-123',
          SignedIn: 1,
          SignedInDate: '2023-01-01',
        },
      },
    ];

    const mockSignInData = [
      {
        id: 'user-123',
        signInActivity: {
          lastSignInDateTime: '2023-01-01T10:00:00Z',
        },
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: { value: mockUsers },
        });
      } else if (url.includes('users?select=id,signInActivity')) {
        return Promise.resolve({
          success: true,
          data: { value: mockSignInData },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    const result = await processor.processSignedInUsers(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle users without sign-in data', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    const mockUsers = [
      {
        id: '1',
        fields: {
          Title: 'Test User',
          ADUserId: 'user-123',
          SignedIn: 1,
          SignedInDate: '2023-01-01',
        },
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: { value: mockUsers },
        });
      } else if (url.includes('users?select=id,signInActivity')) {
        return Promise.resolve({
          success: true,
          data: { value: [] },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    const result = await processor.processSignedInUsers(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle API errors gracefully', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    apiGet.mockImplementation(() => Promise.reject(new Error('API Error')));

    const result = await processor.processSignedInUsers(mockConfig);
    expect(result).toBeInstanceOf(Error);
  });

  test('should handle partial API failures', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    const mockUsers = [
      {
        id: '1',
        fields: {
          Title: 'Test User',
          ADUserId: 'user-123',
          SignedIn: 1,
          SignedInDate: '2023-01-01',
        },
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: { value: mockUsers },
        });
      } else if (url.includes('users?select=id,signInActivity')) {
        return Promise.reject(new Error('Sign-in API Error'));
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    const result = await processor.processSignedInUsers(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle users with no ADUserId', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    const mockUsers = [
      {
        id: '1',
        fields: {
          Title: 'Test User',
          ADUserId: null,
          SignedIn: 1,
          SignedInDate: '2023-01-01',
        },
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: { value: mockUsers },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    const result = await processor.processSignedInUsers(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle empty configuration', async () => {
    const result = await processor.processSignedInUsers({});
    expect(result).toBeUndefined();
  });

  test('should handle null configuration', async () => {
    const result = await processor.processSignedInUsers(null);
    expect(result).toBeInstanceOf(Error);
  });

  test('should process user with successful sign-in and MFA registration', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    const mockUsers = [
      {
        id: '1',
        fields: {
          Title: 'Test User',
          ADUserId: 'user-123',
          Email: 'test@example.com',
          Membership: 'Test Membership',
          OtherMemberships: 'Other Test',
        },
      },
    ];

    const mockADUser = {
      id: 'user-123',
      displayName: 'Test User',
      userType: 'Guest',
      externalUserStateChangeDateTime: '2023-01-01T10:00:00Z',
    };

    const mockRegistrationData = [
      {
        isMfaRegistered: true,
        userDisplayName: 'Test User',
      },
    ];

    const mockMappings = [
      { Membership: 'Test Membership', Tag: 'Test Tag' },
      { Membership: 'Other Test', Tag: 'Other Tag' },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: { value: mockUsers },
        });
      } else if (url.includes('reports/credentialUserRegistrationDetails')) {
        return Promise.resolve({
          success: true,
          data: { value: mockRegistrationData },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    userHelper.getADUser.mockResolvedValue(mockADUser);
    mappingHelper.getMappings.mockReturnValue(mockMappings);
    tagHelper.applyTags.mockResolvedValue();
    apiPatch.mockResolvedValue({
      success: true,
      data: { id: 'updated-user' },
    });

    const result = await processor.processSignedInUsers(mockConfig);
    expect(result).toBeUndefined();
    expect(tagHelper.applyTags).toHaveBeenCalled();
    expect(apiPatch).toHaveBeenCalled();
  });

  test('should handle user without MFA registration', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    const mockUsers = [
      {
        id: '1',
        fields: {
          Title: 'Test User',
          ADUserId: 'user-123',
          Email: 'test@example.com',
        },
      },
    ];

    const mockADUser = {
      id: 'user-123',
      displayName: 'Test User',
      userType: 'Guest',
      externalUserStateChangeDateTime: '2023-01-01T10:00:00Z',
    };

    const mockRegistrationData = [
      {
        isMfaRegistered: false,
        userDisplayName: 'Test User',
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: { value: mockUsers },
        });
      } else if (url.includes('reports/credentialUserRegistrationDetails')) {
        return Promise.resolve({
          success: true,
          data: { value: mockRegistrationData },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    userHelper.getADUser.mockResolvedValue(mockADUser);

    const result = await processor.processSignedInUsers(mockConfig);
    expect(result).toBeUndefined();
    expect(apiPatch).not.toHaveBeenCalled();
  });

  test('should handle API throttling with retry', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    const mockUsers = [
      {
        id: '1',
        fields: {
          Title: 'Test User',
          ADUserId: 'user-123',
          Email: 'test@example.com',
        },
      },
    ];

    const mockADUser = {
      id: 'user-123',
      displayName: 'Test User',
      userType: 'Guest',
    };

    let callCount = 0;
    apiGet.mockImplementation((url) => {
      if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: { value: mockUsers },
        });
      } else if (url.includes('reports/credentialUserRegistrationDetails')) {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            success: false,
            error: {
              response: {
                status: 429,
                headers: { 'retry-after': '1' },
              },
            },
          });
        } else {
          return Promise.resolve({
            success: true,
            data: { value: [{ isMfaRegistered: true }] },
          });
        }
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    userHelper.getADUser.mockResolvedValue(mockADUser);
    mappingHelper.getMappings.mockReturnValue([]);
    apiPatch.mockResolvedValue({ success: true });

    const result = await processor.processSignedInUsers(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle user not found in AD', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    const mockUsers = [
      {
        id: '1',
        fields: {
          Title: 'Test User',
          ADUserId: 'user-123',
          Email: 'test@example.com',
        },
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: { value: mockUsers },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    userHelper.getADUser.mockResolvedValue(null);

    const result = await processor.processSignedInUsers(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle API failures in loadUsers', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    apiGet.mockImplementation((url) => {
      if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: false,
          data: null,
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    const result = await processor.processSignedInUsers(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle patch user errors', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    const mockUsers = [
      {
        id: '1',
        fields: {
          Title: 'Test User',
          ADUserId: 'user-123',
          Email: 'test@example.com',
          Membership: 'Test Membership',
        },
      },
    ];

    const mockADUser = {
      id: 'user-123',
      displayName: 'Test User',
      userType: 'Guest',
    };

    const mockRegistrationData = [
      {
        isMfaRegistered: true,
        userDisplayName: 'Test User',
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: { value: mockUsers },
        });
      } else if (url.includes('reports/credentialUserRegistrationDetails')) {
        return Promise.resolve({
          success: true,
          data: { value: mockRegistrationData },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    userHelper.getADUser.mockResolvedValue(mockADUser);
    mappingHelper.getMappings.mockReturnValue([]);
    tagHelper.applyTags.mockResolvedValue();
    apiPatch.mockRejectedValue(new Error('Patch Error'));

    const result = await processor.processSignedInUsers(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle non-Guest users', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    const mockUsers = [
      {
        id: '1',
        fields: {
          Title: 'Test User',
          ADUserId: 'user-123',
          Email: 'test@example.com',
        },
      },
    ];

    const mockADUser = {
      id: 'user-123',
      displayName: 'Test User',
      userType: 'Member', // Not Guest
      externalUserStateChangeDateTime: '2023-01-01T10:00:00Z',
    };

    const mockRegistrationData = [
      {
        isMfaRegistered: true,
        userDisplayName: 'Test User',
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: { value: mockUsers },
        });
      } else if (url.includes('reports/credentialUserRegistrationDetails')) {
        return Promise.resolve({
          success: true,
          data: { value: mockRegistrationData },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    userHelper.getADUser.mockResolvedValue(mockADUser);

    const result = await processor.processSignedInUsers(mockConfig);
    expect(result).toBeUndefined();
    expect(apiPatch).not.toHaveBeenCalled();
  });
});
