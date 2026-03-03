function setupProcessor() {
  jest.resetModules();

  jest.doMock('../lib/logging', () => ({
    error: jest.fn(),
    info: jest.fn(),
  }));

  jest.doMock('../lib/provider', () => ({
    apiGet: jest.fn(),
    apiPost: jest.fn(),
    apiPatch: jest.fn(),
    apiDelete: jest.fn(),
  }));

  jest.doMock('../lib/graphClient', () => ({
    apiConfigWithSite: {
      uri: 'https://test.sharepoint.com/sites/test/',
    },
    apiConfig: {
      uri: 'https://test.sharepoint.com/sites/test/',
    },
  }));

  jest.doMock('../lib/helpers/userHelper', () => ({
    getADUser: jest.fn(),
  }));

  jest.doMock('../lib/helpers/userGroupHelper', () => ({
    getDistinctGroupsIds: jest.fn(),
    getExistingGroups: jest.fn(),
  }));

  jest.doMock('../lib/helpers/mappingHelper', () => ({
    initialize: jest.fn(),
    getMappings: jest.fn(),
  }));

  jest.doMock('../lib/helpers/tagHelper', () => ({
    initialize: jest.fn(),
  }));

  const processor = require('./userRemovalProcessor');
  const logging = require('../lib/logging');
  const { apiGet, apiPatch, apiDelete } = require('../lib/provider');
  const userHelper = require('../lib/helpers/userHelper');
  const userGroupHelper = require('../lib/helpers/userGroupHelper');
  const mappingHelper = require('../lib/helpers/mappingHelper');
  const tagHelper = require('../lib/helpers/tagHelper');

  return {
    processor,
    logging,
    apiGet,
    apiPatch,
    apiDelete,
    userHelper,
    userGroupHelper,
    mappingHelper,
    tagHelper,
  };
}

describe('userRemovalProcessor', () => {
  test('Signed In null in no activity', () => {
    const { processor } = setupProcessor();
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
    const { processor } = setupProcessor();
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
    const { processor } = setupProcessor();
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
    const { processor } = setupProcessor();
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
    const { processor } = setupProcessor();
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
    const { processor } = setupProcessor();
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

  test('Signed In 1 with null last sign-in activity is not removed', () => {
    const { processor } = setupProcessor();
    const userData = {
        createdDateTime: '2023-04-01',
        fields: {
          SignedIn: 1,
        },
      },
      activity = {
        signInActivity: {
          lastSignInDateTime: null,
        },
      },
      filterDate = new Date('2023-04-25'),
      lastSignInDate = new Date('2023-08-01');
    expect(processor.shouldRemoveUser(userData, activity, filterDate, lastSignInDate)).toBe(false);
  });

  test('processUserRemoval returns users enriched with organisation and last sign-in', async () => {
    const {
      processor,
      apiGet,
      apiPatch,
      apiDelete,
      mappingHelper,
      tagHelper,
      userHelper,
      userGroupHelper,
    } = setupProcessor();
    const mockConfig = {
      UserListId: 'user-list-id',
      OrganisationListId: 'org-list-id',
      RemoveNonSignedInUserNoOfDays: 30,
      UserRemovalLastSignInDateTime: '2023-08-01',
    };

    const mockContext = {
      log: jest.fn(),
    };

    apiGet.mockImplementation((url) => {
      if (url.includes('lists/user-list-id/items')) {
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
                  SignedIn: 1,
                  OrganisationLookupId: 'org-1',
                  LastSignInDate: undefined,
                  ADUserId: 'ae40523c-d750-41f5-9873-6346b474e5fb',
                },
              },
            ],
          },
        });
      } else if (url.includes('lists/org-list-id/items')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                id: 'org-1',
                fields: {
                  Title: 'Organisation Name',
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
                  lastSignInDateTime: '2023-04-01T00:00:00.000Z',
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
    tagHelper.initialize.mockResolvedValue();
    mappingHelper.getMappings.mockReturnValue([]);
    userHelper.getADUser.mockResolvedValue({ id: 'user-id' });
    userGroupHelper.getDistinctGroupsIds.mockReturnValue([]);
    userGroupHelper.getExistingGroups.mockResolvedValue([]);

    const result = await processor.processUserRemoval(mockContext, mockConfig, false);
    expect(mappingHelper.initialize).toHaveBeenCalledWith(mockConfig);
    expect(tagHelper.initialize).toHaveBeenCalledWith('UserRemoval', mockConfig);
    expect(result).toHaveLength(1);
    expect(result[0].organisationName).toBe('Organisation Name');
    expect(result[0].lastSignInDateTime).toBe('2023-04-01T00:00:00.000Z');
  });

  test('processUserRemoval with applyRemove deletes users from AD groups and list', async () => {
    const {
      processor,
      apiGet,
      apiPatch,
      apiDelete,
      mappingHelper,
      tagHelper,
      userHelper,
      userGroupHelper,
      logging,
    } = setupProcessor();

    const mockConfig = {
      UserListId: 'user-list-id',
      OrganisationListId: 'org-list-id',
      RemoveNonSignedInUserNoOfDays: 30,
      UserRemovalLastSignInDateTime: '2023-08-01',
      NFPGroupId: 'nfp-group',
      MainEionetGroupId: 'main-group',
    };

    apiGet.mockImplementation((url) => {
      if (url.includes('lists/user-list-id/items')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                id: '36',
                createdDateTime: '2023-04-01',
                fields: {
                  id: '36',
                  Title: 'Removable User',
                  Country: 'RO',
                  Email: 'user@example.com',
                  Membership: ['MemberA'],
                  OtherMemberships: ['MemberB'],
                  NFP: true,
                  SignedIn: 1,
                  OrganisationLookupId: 'org-1',
                  ADUserId: 'ad-user-id',
                },
              },
            ],
          },
        });
      }

      if (url.includes('lists/org-list-id/items')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [{ id: 'org-1', fields: { Title: 'Org' } }],
          },
        });
      }

      if (url.includes('users?select=id,displayName,signInActivity')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                id: 'ad-user-id',
                signInActivity: { lastSignInDateTime: '2023-01-01T00:00:00.000Z' },
              },
            ],
          },
        });
      }

      return Promise.resolve({ success: false, data: null });
    });

    mappingHelper.initialize.mockResolvedValue();
    tagHelper.initialize.mockResolvedValue();
    mappingHelper.getMappings.mockReturnValue([
      { Membership: 'MemberA', O365GroupId: 'map-group-1' },
      { Membership: 'MemberB', O365GroupId: 'map-group-2' },
    ]);
    userHelper.getADUser.mockResolvedValue({ id: 'ad-user-id' });
    userGroupHelper.getDistinctGroupsIds.mockReturnValue(['map-group-1']);
    userGroupHelper.getExistingGroups.mockResolvedValue(['map-group-1', 'nfp-group', 'main-group']);

    apiPatch.mockResolvedValue({ success: true });
    apiDelete.mockResolvedValue({ success: true });

    const result = await processor.processUserRemoval({ log: jest.fn() }, mockConfig, true);

    expect(result).toBeUndefined();
    expect(userGroupHelper.getExistingGroups).toHaveBeenCalledWith('ad-user-id', [
      'map-group-1',
      'nfp-group',
      'main-group',
    ]);
    expect(apiDelete).toHaveBeenCalledWith(
      'https://test.sharepoint.com/sites/test//groups/map-group-1/members/ad-user-id/$ref',
    );
    expect(apiPatch).toHaveBeenCalledWith(
      'https://test.sharepoint.com/sites/test//users/ad-user-id',
      {
        displayName: 'Removable User',
        department: 'Ex-Eionet',
        country: null,
      },
    );
    expect(apiDelete).toHaveBeenCalledWith(
      'https://test.sharepoint.com/sites/test/lists/user-list-id/items/36',
    );
    expect(logging.info).toHaveBeenCalledWith(
      mockConfig,
      'User was removed from list.',
      '',
      expect.objectContaining({ Email: 'user@example.com' }),
      'UserRemoval',
      'Remove user',
      'user@example.com',
    );
  });

  test('processUserRemoval logs and returns undefined when no users are removable', async () => {
    const { processor, apiGet, mappingHelper, tagHelper } = setupProcessor();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const mockConfig = {
      UserListId: 'user-list-id',
      OrganisationListId: 'org-list-id',
      RemoveNonSignedInUserNoOfDays: 30,
      UserRemovalLastSignInDateTime: '2023-08-01',
    };

    apiGet.mockImplementation((url) => {
      if (url.includes('lists/user-list-id/items')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                id: '1',
                createdDateTime: '2099-01-01',
                fields: {
                  SignedIn: 0,
                  ADUserId: 'ad-user-id',
                },
              },
            ],
          },
        });
      }
      if (
        url.includes('lists/org-list-id/items') ||
        url.includes('users?select=id,displayName,signInActivity')
      ) {
        return Promise.resolve({ success: true, data: { value: [] } });
      }
      return Promise.resolve({ success: false, data: null });
    });

    mappingHelper.initialize.mockResolvedValue();
    tagHelper.initialize.mockResolvedValue();

    const result = await processor.processUserRemoval({ log: jest.fn() }, mockConfig, false);

    expect(result).toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith('No users to remove.');
    logSpy.mockRestore();
  });

  test('processUserRemoval returns error when initialization fails', async () => {
    const { processor, mappingHelper, logging } = setupProcessor();
    const config = {
      UserListId: 'user-list-id',
      OrganisationListId: 'org-list-id',
      RemoveNonSignedInUserNoOfDays: 30,
      UserRemovalLastSignInDateTime: '2023-08-01',
    };
    const err = new Error('Initialization failed');
    mappingHelper.initialize.mockRejectedValue(err);

    const result = await processor.processUserRemoval({ log: jest.fn() }, config, false);

    expect(result).toBe(err);
    expect(logging.error).toHaveBeenCalledWith(config, err, 'UserRemoval');
  });
});
