const processor = require('./userRemovalProcessor');

// Mock all dependencies
jest.mock('../lib/logging', () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

jest.mock('../lib/provider', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPatch: jest.fn(),
  apiDelete: jest.fn(),
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

jest.mock('../lib/helpers/userGroupHelper', () => ({
  getDistinctGroupsIds: jest.fn(),
  getExistingGroups: jest.fn(),
}));

jest.mock('../lib/helpers/mappingHelper', () => ({
  initialize: jest.fn(),
  getMappings: jest.fn(),
}));

jest.mock('../lib/helpers/tagHelper', () => ({
  initialize: jest.fn(),
}));

// Get the mocked functions
const { apiGet, apiPatch, apiDelete } = require('../lib/provider');
const userHelper = require('../lib/helpers/userHelper');
const userGroupHelper = require('../lib/helpers/userGroupHelper');
const mappingHelper = require('../lib/helpers/mappingHelper');

describe('userRemovalProcessor', () => {
  test('Signed In null in no activity', () => {
    const userData = {
        createdDateTime: '2022-04-25',
        fields: {
          SignedIn: null,
        },
      },
      activity = {},
      filterDate = new Date('2023-04-25'),
      lastSignInDate = new Date('2023-08-01');
    expect(processor.shouldRemoveUser(userData, activity, filterDate, lastSignInDate)).toBe(true);
  });

  test('Signed In 0 no activity', () => {
    const userData = {
        createdDateTime: '2022-04-25',
        fields: {
          SignedIn: 0,
        },
      },
      activity = {},
      filterDate = new Date('2023-04-25'),
      lastSignInDate = new Date('2023-08-01');
    expect(processor.shouldRemoveUser(userData, activity, filterDate, lastSignInDate)).toBe(true);
  });

  test('Signed In 0 no activity new', () => {
    const userData = {
        createdDateTime: '2024-04-25',
        fields: {
          SignedIn: 0,
        },
      },
      activity = {},
      filterDate = new Date('2023-04-25'),
      lastSignInDate = new Date('2023-08-01');
    expect(processor.shouldRemoveUser(userData, activity, filterDate, lastSignInDate)).toBe(false);
  });

  test('Signed In 1 no activity', () => {
    const userData = {
        createdDateTime: '2023-04-01',
        fields: {
          SignedIn: 1,
        },
      },
      activity = {},
      filterDate = new Date('2023-04-25'),
      lastSignInDate = new Date('2023-08-01');
    expect(processor.shouldRemoveUser(userData, activity, filterDate, lastSignInDate)).toBe(true);
  });

  test('Signed In 1 with activity', () => {
    const userData = {
        createdDateTime: '2023-04-01',
        fields: {
          SignedIn: 1,
        },
      },
      activity = {
        signInActivity: {
          lastSignInDateTime: '2024-03-01',
        },
      },
      filterDate = new Date('2023-04-25'),
      lastSignInDate = new Date('2023-08-01');
    expect(processor.shouldRemoveUser(userData, activity, filterDate, lastSignInDate)).toBe(false);
  });

  test('Signed In 1 with activity in the past', () => {
    const userData = {
        createdDateTime: '2023-04-01',
        fields: {
          SignedIn: 1,
        },
      },
      activity = {
        signInActivity: {
          lastSignInDateTime: '2023-03-01',
        },
      },
      filterDate = new Date('2023-04-25'),
      lastSignInDate = new Date('2023-08-01');
    expect(processor.shouldRemoveUser(userData, activity, filterDate, lastSignInDate)).toBe(true);
  });

  test('processUserRemoval', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
      RemoveNonSignedInUserNoOfDays: 30,
      UserRemovalLastSignInDateTime: '2023-08-01',
    };

    const mockContext = {
      log: jest.fn(),
    };

    apiGet.mockImplementation((url) => {
      if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                id: '36',
                createdDateTime: '2023-04-01',
                fields: {
                  id: '36',
                  Title: 'REAL Ionel Ganea',
                  Country: 'RO',
                  LastSignInDate: undefined,
                  ADUserId: 'ae40523c-d750-41f5-9873-6346b474e5fb',
                },
              },
            ],
          },
        });
      } else if (url.includes('users?select=id,displayName,signInActivity')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                id: 'ae40523c-d750-41f5-9873-6346b474e5fb',
                displayName: 'REAL Ionel Ganea',
                signInActivity: {
                  lastSignInDateTime: '2023-04-01',
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

    apiDelete.mockImplementation(() =>
      Promise.resolve({
        success: true,
        data: {},
      }),
    );

    // Mock helper functions
    mappingHelper.initialize.mockResolvedValue();
    mappingHelper.getMappings.mockReturnValue([]);
    userHelper.getADUser.mockResolvedValue({ id: 'user-id' });
    userGroupHelper.getDistinctGroupsIds.mockReturnValue([]);
    userGroupHelper.getExistingGroups.mockResolvedValue([]);

    const result = await processor.processUserRemoval(mockContext, mockConfig, false);
    expect(result).toBeUndefined();
  });
});
