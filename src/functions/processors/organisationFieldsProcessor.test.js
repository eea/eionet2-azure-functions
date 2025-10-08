const processor = require('./organisationFieldsProcessor');

// Mock all dependencies
jest.mock('../lib/logging', () => ({
  error: jest.fn(),
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

jest.mock('../lib/helpers/userHelper');
jest.mock('../lib/helpers/utils');

// Get the mocked functions
const { apiGet, apiPatch } = require('../lib/provider');

// Mock data
const mockOrganisation = {
  id: '1',
  fields: {
    Title: 'Test Organisation',
    Members: 5,
  },
};

const mockUser = {
  id: '1',
  fields: {
    OrganisationLookupId: '1',
  },
};

const mockConfiguration = {
  OrganisationListId: 'org-list-id',
  UserListId: 'user-list-id',
};

const mockContext = {
  log: jest.fn(),
};

describe('organisationFieldsProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processOrganisations', () => {
    test('should process organisations successfully', async () => {
      // Mock successful API responses
      apiGet.mockImplementation((url) => {
        if (url.includes('org-list-id') && url.includes('items?$expand=fields')) {
          return Promise.resolve({
            success: true,
            data: {
              value: [mockOrganisation],
            },
          });
        } else if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
          return Promise.resolve({
            success: true,
            data: {
              value: [mockUser],
            },
          });
        } else if (url.includes('items/1') && !url.includes('items?$expand=fields')) {
          return Promise.resolve({
            success: true,
            data: {
              fields: {
                Title: 'Test Organisation',
                Members: 3,
              },
            },
          });
        }
        return Promise.resolve({ success: false, data: null });
      });

      apiPatch.mockImplementation(() =>
        Promise.resolve({
          success: true,
          data: { id: '1' },
        }),
      );

      const result = await processor.processOrganisations(mockConfiguration, mockContext);

      expect(result).toBeUndefined();
      expect(mockContext.log).toHaveBeenCalledWith(
        'Number of organisations to process for fields update: 1',
      );
    });

    test('should handle errors during processing', async () => {
      const error = new Error('API Error');
      apiGet.mockImplementation(() => Promise.reject(error));

      const result = await processor.processOrganisations(mockConfiguration, mockContext);

      expect(result).toBe(error);
    });
  });

  describe('integration scenarios', () => {
    test('should handle multiple organisations with different member counts', async () => {
      const organisations = [
        { id: '1', fields: { Title: 'Org 1' } },
        { id: '2', fields: { Title: 'Org 2' } },
      ];

      const users = [
        { fields: { OrganisationLookupId: '1' } },
        { fields: { OrganisationLookupId: '1' } },
        { fields: { OrganisationLookupId: '2' } },
      ];

      apiGet.mockImplementation((url) => {
        if (url.includes('org-list-id') && url.includes('items?$expand=fields')) {
          return Promise.resolve({
            success: true,
            data: { value: organisations },
          });
        } else if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
          return Promise.resolve({
            success: true,
            data: { value: users },
          });
        } else if (url.includes('items/1') && !url.includes('items?$expand=fields')) {
          return Promise.resolve({
            success: true,
            data: {
              fields: { Title: 'Org 1', Members: 1 },
            },
          });
        } else if (url.includes('items/2') && !url.includes('items?$expand=fields')) {
          return Promise.resolve({
            success: true,
            data: {
              fields: { Title: 'Org 2', Members: 0 },
            },
          });
        }
        return Promise.resolve({ success: false, data: null });
      });

      apiPatch.mockImplementation(() =>
        Promise.resolve({
          success: true,
          data: { id: '1' },
        }),
      );

      const result = await processor.processOrganisations(mockConfiguration, mockContext);

      expect(result).toBeUndefined();
      expect(apiPatch).toHaveBeenCalledTimes(2);
    });

    test('should handle empty organisation list', async () => {
      apiGet.mockImplementation((url) => {
        if (url.includes('org-list-id') && url.includes('items?$expand=fields')) {
          return Promise.resolve({
            success: true,
            data: { value: [] },
          });
        } else if (url.includes('user-list-id') && url.includes('items?$expand=fields')) {
          return Promise.resolve({
            success: true,
            data: { value: [] },
          });
        }
        return Promise.resolve({ success: false, data: null });
      });

      const result = await processor.processOrganisations(mockConfiguration, mockContext);

      expect(result).toBeUndefined();
      expect(mockContext.log).toHaveBeenCalledWith('Number of users loaded: 0');
    });
  });
});
