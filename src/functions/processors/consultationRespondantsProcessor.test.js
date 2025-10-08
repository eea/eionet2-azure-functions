const processor = require('./consultationRespondantsProcessor');

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
  apiConfigWithSecondarySite: {
    uri: 'https://test-secondary.sharepoint.com/sites/test/',
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
const { apiGet, apiPatch } = require('../lib/provider');

describe('consultationRespondantsProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should process consultations successfully with empty data', async () => {
    const mockConfig = {
      ConsultationListId: 'consultation-list-id',
    };

    apiGet.mockImplementation(() =>
      Promise.resolve({
        success: true,
        data: { value: [] },
      }),
    );

    const result = await processor.processConsultations(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should process consultations with data', async () => {
    const mockConfig = {
      ConsultationListId: 'consultation-list-id',
    };

    const mockConsultations = [
      {
        id: '1',
        fields: {
          Title: 'Test Consultation',
          ConsultationListId: 'list-123',
          Startdate: '2023-01-01',
          Closed: '2023-12-31',
        },
      },
    ];

    const mockCountries = ['RO', 'DE', 'FR'];
    const mockColumns = [{ name: 'Respondants', choice: { choices: mockCountries } }];

    const mockListData = [
      { fields: { Country: 'RO' } },
      { fields: { Country: 'DE' } },
      { fields: { Country: 'FR' } },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('items?$expand=fields&$top=999&$filter=')) {
        return Promise.resolve({
          success: true,
          data: { value: mockConsultations },
        });
      } else if (url.includes('/columns')) {
        return Promise.resolve({
          success: true,
          data: { value: mockColumns },
        });
      } else if (url.includes('lists/list-123/items')) {
        return Promise.resolve({
          success: true,
          data: { value: mockListData },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    apiPatch.mockResolvedValue({
      success: true,
      data: { id: 'updated-consultation' },
    });

    const result = await processor.processConsultations(mockConfig);
    expect(result).toBeUndefined();
    expect(apiPatch).toHaveBeenCalledWith(
      expect.stringContaining('consultation-list-id/items/1'),
      expect.objectContaining({
        fields: expect.objectContaining({
          'Respondants@odata.type': 'Collection(Edm.String)',
          Respondants: mockCountries,
        }),
      }),
    );
  });

  test('should handle API errors gracefully', async () => {
    const mockConfig = {
      ConsultationListId: 'consultation-list-id',
    };

    apiGet.mockImplementation(() => Promise.reject(new Error('API Error')));

    const result = await processor.processConsultations(mockConfig);
    expect(result).toBeInstanceOf(Error);
  });

  test('should handle consultations without ConsultationListId', async () => {
    const mockConfig = {
      ConsultationListId: 'consultation-list-id',
    };

    const mockConsultations = [
      {
        id: '1',
        fields: {
          Title: 'Test Consultation',
          ConsultationListId: null,
          Startdate: '2023-01-01',
          Closed: '2023-12-31',
        },
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('items?$expand=fields&$top=999&$filter=')) {
        return Promise.resolve({
          success: true,
          data: { value: mockConsultations },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    const result = await processor.processConsultations(mockConfig);
    expect(result).toBeUndefined();
    // Should not call apiPatch when ConsultationListId is null
    expect(apiPatch).not.toHaveBeenCalled();
  });

  test('should handle consultations when URL loading fails', async () => {
    const mockConfig = {
      ConsultationListId: 'consultation-list-id',
    };

    const mockConsultations = [
      {
        id: '1',
        fields: {
          Title: 'Test Consultation',
          ConsultationListId: null,
          LinkToConsultation: 'invalid-url',
          Startdate: '2023-01-01',
          Closed: '2023-12-31',
        },
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('items?$expand=fields&$top=999&$filter=')) {
        return Promise.resolve({
          success: true,
          data: { value: mockConsultations },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    const result = await processor.processConsultations(mockConfig);
    expect(result).toBeUndefined();
    // Should not call apiPatch when ConsultationListId cannot be determined
    expect(apiPatch).not.toHaveBeenCalled();
  });

  test('should handle consultations with missing Country column', async () => {
    const mockConfig = {
      ConsultationListId: 'consultation-list-id',
    };

    const mockConsultations = [
      {
        id: '1',
        fields: {
          Title: 'Test Consultation',
          ConsultationListId: 'list-123',
          Startdate: '2023-01-01',
          Closed: '2023-12-31',
        },
      },
    ];

    const mockColumns = [{ name: 'Respondants', choice: { choices: ['RO', 'DE'] } }];

    const mockListData = [
      { fields: { Title: 'Test Record' } }, // No Country field
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('items?$expand=fields&$top=999&$filter=')) {
        return Promise.resolve({
          success: true,
          data: { value: mockConsultations },
        });
      } else if (url.includes('/columns')) {
        return Promise.resolve({
          success: true,
          data: { value: mockColumns },
        });
      } else if (url.includes('lists/list-123/items')) {
        return Promise.resolve({
          success: true,
          data: { value: mockListData },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    const result = await processor.processConsultations(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle API failures in loadConsulations', async () => {
    const mockConfig = {
      ConsultationListId: 'consultation-list-id',
    };

    apiGet.mockImplementation((url) => {
      if (url.includes('items?$expand=fields&$top=999&$filter=')) {
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

    const result = await processor.processConsultations(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle patch consultation errors', async () => {
    const mockConfig = {
      ConsultationListId: 'consultation-list-id',
    };

    const mockConsultations = [
      {
        id: '1',
        fields: {
          Title: 'Test Consultation',
          ConsultationListId: 'list-123',
          Startdate: '2023-01-01',
          Closed: '2023-12-31',
        },
      },
    ];

    const mockColumns = [{ name: 'Respondants', choice: { choices: ['RO', 'DE'] } }];

    const mockListData = [{ fields: { Country: 'RO' } }];

    apiGet.mockImplementation((url) => {
      if (url.includes('items?$expand=fields&$top=999&$filter=')) {
        return Promise.resolve({
          success: true,
          data: { value: mockConsultations },
        });
      } else if (url.includes('/columns')) {
        return Promise.resolve({
          success: true,
          data: { value: mockColumns },
        });
      } else if (url.includes('lists/list-123/items')) {
        return Promise.resolve({
          success: true,
          data: { value: mockListData },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    apiPatch.mockRejectedValue(new Error('Patch Error'));

    const result = await processor.processConsultations(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle empty configuration', async () => {
    const result = await processor.processConsultations({});
    expect(result).toBeUndefined();
  });
});
