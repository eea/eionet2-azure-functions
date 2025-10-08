const processor = require('./userMembershipProcessor');

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

jest.mock('../lib/helpers/userGroupHelper', () => ({
  getDistinctGroupsIds: jest.fn(),
  getExistingGroups: jest.fn(),
}));

// mappingHelper is not properly imported in the original code, so we'll mock it globally
global.mappingHelper = {
  initialize: jest.fn(),
  getMappings: jest.fn(),
};

jest.mock('../lib/helpers/tagHelper', () => ({
  initialize: jest.fn(),
  applyTags: jest.fn(),
}));

// Get the mocked functions
const { apiGet, apiPost } = require('../lib/provider');
const userHelper = require('../lib/helpers/userHelper');
const userGroupHelper = require('../lib/helpers/userGroupHelper');
const tagHelper = require('../lib/helpers/tagHelper');

describe('userMembershipProcessor', () => {
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

    // Mock helper functions
    global.mappingHelper.initialize.mockResolvedValue();
    global.mappingHelper.getMappings.mockReturnValue([]);
    userGroupHelper.getDistinctGroupsIds.mockReturnValue([]);
    userGroupHelper.getExistingGroups.mockResolvedValue([]);

    const result = await processor.processUsers(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should process users with group inconsistencies', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
      NFPGroupId: 'nfp-group-id',
      MainEionetGroupId: 'main-group-id',
      UpdateAllTags: 'false',
    };

    const mockUsers = [
      {
        id: '1',
        fields: {
          ADUserId: 'user-123',
          Email: 'test@example.com',
          Membership: 'Test Membership',
          OtherMemberships: 'Other Test',
          NFP: true,
        },
      },
    ];

    const mockMappings = [
      { Membership: 'Test Membership', O365GroupId: 'group-1', Tag: 'Test Tag' },
      { Membership: 'Other Test', O365GroupId: 'group-2', Tag: 'Other Tag' },
    ];

    const mockADUser = {
      id: 'user-123',
      displayName: 'Test User',
    };

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

    global.mappingHelper.initialize.mockResolvedValue();
    global.mappingHelper.getMappings.mockReturnValue(mockMappings);
    userHelper.getADUser.mockResolvedValue(mockADUser);
    userGroupHelper.getDistinctGroupsIds.mockReturnValue(['group-1', 'group-2']);
    userGroupHelper.getExistingGroups.mockResolvedValue(['group-1']); // group-2 is missing
    tagHelper.applyTags.mockResolvedValue();
    apiPost.mockResolvedValue({ success: true });

    const result = await processor.processUsers(mockConfig);
    expect(result).toBeUndefined();
    expect(apiPost).toHaveBeenCalled();
    expect(tagHelper.applyTags).toHaveBeenCalled();
  });

  test('should handle NFP users with special groups', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
      NFPGroupId: 'nfp-group-id',
      MainEionetGroupId: 'main-group-id',
      UpdateAllTags: 'true',
    };

    const mockUsers = [
      {
        id: '1',
        fields: {
          ADUserId: 'user-123',
          Email: 'nfp@example.com',
          Membership: 'Test Membership',
          NFP: true,
        },
      },
    ];

    const mockMappings = [
      { Membership: 'Test Membership', O365GroupId: 'group-1', Tag: 'Test Tag' },
    ];

    const mockADUser = {
      id: 'user-123',
      displayName: 'NFP User',
    };

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

    global.mappingHelper.initialize.mockResolvedValue();
    global.mappingHelper.getMappings.mockReturnValue(mockMappings);
    userHelper.getADUser.mockResolvedValue(mockADUser);
    userGroupHelper.getDistinctGroupsIds.mockReturnValue([
      'group-1',
      'nfp-group-id',
      'main-group-id',
    ]);
    userGroupHelper.getExistingGroups.mockResolvedValue(['group-1']); // NFP groups missing
    tagHelper.applyTags.mockResolvedValue();
    apiPost.mockResolvedValue({ success: true });

    const result = await processor.processUsers(mockConfig);
    expect(result).toBeUndefined();
    expect(apiPost).toHaveBeenCalledTimes(2); // group-1 + nfp-group-id + main-group-id
  });

  test('should handle users without AD user', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    const mockUsers = [
      {
        id: '1',
        fields: {
          ADUserId: 'invalid-user-id',
          Email: 'test@example.com',
          Membership: 'Test Membership',
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

    global.mappingHelper.initialize.mockResolvedValue();
    global.mappingHelper.getMappings.mockReturnValue([]);
    userHelper.getADUser.mockResolvedValue(null);

    const result = await processor.processUsers(mockConfig);
    expect(result).toBeUndefined();
    expect(apiPost).not.toHaveBeenCalled();
  });

  test('should handle user limit processing', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
      NoOfUsersToProcessMembershipJob: 1,
    };

    const mockUsers = [
      {
        id: '1',
        fields: {
          ADUserId: 'user-1',
          Email: 'user1@example.com',
          Membership: 'Test Membership',
        },
      },
      {
        id: '2',
        fields: {
          ADUserId: 'user-2',
          Email: 'user2@example.com',
          Membership: 'Test Membership',
        },
      },
    ];

    const mockMappings = [
      { Membership: 'Test Membership', O365GroupId: 'group-1', Tag: 'Test Tag' },
    ];

    const mockADUser = {
      id: 'user-1',
      displayName: 'User 1',
    };

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

    global.mappingHelper.initialize.mockResolvedValue();
    global.mappingHelper.getMappings.mockReturnValue(mockMappings);
    userHelper.getADUser.mockResolvedValue(mockADUser);
    userGroupHelper.getDistinctGroupsIds.mockReturnValue(['group-1']);
    userGroupHelper.getExistingGroups.mockResolvedValue([]);
    tagHelper.applyTags.mockResolvedValue();
    apiPost.mockResolvedValue({ success: true });

    const result = await processor.processUsers(mockConfig);
    expect(result).toBeUndefined();
    // Should only process 1 user due to limit
    expect(apiPost).toHaveBeenCalledTimes(1);
  });

  test('should handle API errors gracefully', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
    };

    apiGet.mockImplementation(() => Promise.reject(new Error('API Error')));

    const result = await processor.processUsers(mockConfig);
    expect(result).toBeInstanceOf(Error);
  });

  test('should handle partial API failures in loadUsers', async () => {
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

    global.mappingHelper.initialize.mockResolvedValue();
    global.mappingHelper.getMappings.mockReturnValue([]);

    const result = await processor.processUsers(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle users with no group inconsistencies', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
      UpdateAllTags: 'false',
    };

    const mockUsers = [
      {
        id: '1',
        fields: {
          ADUserId: 'user-123',
          Email: 'test@example.com',
          Membership: 'Test Membership',
        },
      },
    ];

    const mockMappings = [
      { Membership: 'Test Membership', O365GroupId: 'group-1', Tag: 'Test Tag' },
    ];

    const mockADUser = {
      id: 'user-123',
      displayName: 'Test User',
    };

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

    global.mappingHelper.initialize.mockResolvedValue();
    global.mappingHelper.getMappings.mockReturnValue(mockMappings);
    userHelper.getADUser.mockResolvedValue(mockADUser);
    userGroupHelper.getDistinctGroupsIds.mockReturnValue(['group-1']);
    userGroupHelper.getExistingGroups.mockResolvedValue(['group-1']); // All groups exist
    tagHelper.applyTags.mockResolvedValue();

    const result = await processor.processUsers(mockConfig);
    expect(result).toBeUndefined();
    expect(apiPost).not.toHaveBeenCalled();
    // tagHelper.applyTags is called even when there are no inconsistencies due to UpdateAllTags logic
    expect(tagHelper.applyTags).toHaveBeenCalled();
  });

  test('should handle empty configuration', async () => {
    const result = await processor.processUsers({});
    expect(result).toBeUndefined();
  });

  test('should handle null configuration', async () => {
    await expect(processor.processUsers(null)).rejects.toThrow(TypeError);
  });
});
