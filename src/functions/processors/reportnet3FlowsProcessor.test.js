const processor = require('./reportnet3FlowsProcessor');

// Mock all dependencies
jest.mock('../lib/logging', () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

jest.mock('../lib/provider', () => ({
  apiGet: jest.fn(),
  apiPatch: jest.fn(),
  apiPost: jest.fn(),
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
  getUserByMail: jest.fn(),
}));

jest.mock('../lib/helpers/utils', () => ({
  capitalize: jest.fn(),
}));

jest.mock('axios', () => ({
  default: {
    request: jest.fn(),
  },
}));

// Get the mocked functions
const { apiGet, apiPatch, apiPost, apiDelete } = require('../lib/provider');
const utils = require('../lib/helpers/utils');
const axios = require('axios');

describe('reportnet3FlowsProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should process flows successfully with empty data', async () => {
    const mockConfig = {
      ReportnetFlowsListId: 'flows-list-id',
      ObligationsListId: 'obligations-list-id',
    };

    apiGet.mockImplementation(() =>
      Promise.resolve({
        success: true,
        data: { value: [] },
      }),
    );

    const result = await processor.processFlows(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle countries data loading', async () => {
    const mockConfig = {
      ReportnetFlowsListId: 'flows-list-id',
      ObligationsListId: 'obligations-list-id',
    };

    const mockCountries = [
      { id: '1', fields: { Title: 'Romania', Code: 'RO' } },
      { id: '2', fields: { Title: 'Germany', Code: 'DE' } },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('countries')) {
        return Promise.resolve({
          success: true,
          data: { value: mockCountries },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    const result = await processor.processFlows(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle flows data loading', async () => {
    const mockConfig = {
      ReportnetFlowsListId: 'flows-list-id',
      ObligationsListId: 'obligations-list-id',
    };

    const mockFlows = [
      { id: '1', fields: { Title: 'Flow 1', Country: 'RO' } },
      { id: '2', fields: { Title: 'Flow 2', Country: 'DE' } },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('flows-list-id')) {
        return Promise.resolve({
          success: true,
          data: { value: mockFlows },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    const result = await processor.processFlows(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle obligations data loading', async () => {
    const mockConfig = {
      ReportnetFlowsListId: 'flows-list-id',
      ObligationsListId: 'obligations-list-id',
    };

    const mockObligations = [
      { id: '1', fields: { Title: 'Obligation 1', Country: 'RO' } },
      { id: '2', fields: { Title: 'Obligation 2', Country: 'DE' } },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('obligations-list-id')) {
        return Promise.resolve({
          success: true,
          data: { value: mockObligations },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    const result = await processor.processFlows(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle API errors gracefully', async () => {
    const mockConfig = {
      ReportnetFlowsListId: 'flows-list-id',
      ObligationsListId: 'obligations-list-id',
    };

    apiGet.mockImplementation(() => Promise.reject(new Error('API Error')));

    const result = await processor.processFlows(mockConfig);
    expect(result).toBeInstanceOf(Error);
  });

  test('should handle partial API failures', async () => {
    const mockConfig = {
      ReportnetFlowsListId: 'flows-list-id',
      ObligationsListId: 'obligations-list-id',
    };

    apiGet.mockImplementation((url) => {
      if (url.includes('countries')) {
        return Promise.resolve({
          success: true,
          data: { value: [{ id: '1', fields: { Title: 'Romania' } }] },
        });
      } else if (url.includes('flows-list-id')) {
        return Promise.reject(new Error('Flows API Error'));
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    const result = await processor.processFlows(mockConfig);
    expect(result).toBeInstanceOf(Error);
  });

  test('should handle empty configuration', async () => {
    const result = await processor.processFlows({});
    expect(result).toBeUndefined();
  });

  test('should handle null configuration', async () => {
    const result = await processor.processFlows(null);
    expect(result).toBeInstanceOf(Error);
  });

  test('should process flows with complete data flow', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
      ReportnetFlowsListId: 'flows-list-id',
      ObligationsListId: 'obligations-list-id',
      Reportnet3DataflowUrl: 'https://api.reportnet3.eu/',
      Reportnet2DataflowPublicUrl: 'https://public.reportnet2.eu/',
    };

    // Mock environment variable
    process.env.REACT_APP_REPORTNET3_KEY = 'test-key';

    const mockCountries = ['RO', 'DE'];
    const mockColumns = [{ name: 'Country', choice: { choices: mockCountries } }];

    const mockSpFlows = [
      {
        id: '1',
        fields: {
          DataflowId: 'flow-123',
          Country: 'RO',
          DataflowName: 'Existing Flow',
        },
      },
    ];

    const mockSpObligations = [
      {
        id: '1',
        fields: {
          Url: 'https://obligation-link.com',
          IsEEACore: true,
        },
      },
    ];

    const mockReportnetFlows = [
      {
        id: 'flow-123',
        name: 'Test Flow',
        status: 'draft',
        showPublicInfo: true,
        releasable: true,
        deadlineDate: '2023-12-31',
        obligation: {
          oblTitle: 'Test Obligation',
          obligationLink: 'https://obligation-link.com',
          legalInstrument: {
            sourceAlias: 'Test Legal Instrument',
            legalInstrumentLink: 'https://legal-link.com',
          },
        },
        representatives: [
          {
            leadReporters: [{ email: 'test1@example.com' }, { email: 'test2@example.com' }],
          },
        ],
        releasedDates: [1640995200000, 1641081600000], // 2022-01-01, 2022-01-02
        reportingDatasets: [{ status: 'delivered', creationDate: 1640995200000 }],
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('/columns')) {
        return Promise.resolve({
          success: true,
          data: { value: mockColumns },
        });
      } else if (url.includes('flows-list-id')) {
        return Promise.resolve({
          success: true,
          data: { value: mockSpFlows },
        });
      } else if (url.includes('obligations-list-id')) {
        return Promise.resolve({
          success: true,
          data: { value: mockSpObligations },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    axios.default.request.mockResolvedValue({
      data: {
        totalRecords: 1,
        dataflows: mockReportnetFlows,
      },
    });

    utils.capitalize.mockImplementation((str) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    apiPatch.mockResolvedValue({ success: true });
    apiPost.mockResolvedValue({ success: true });

    const result = await processor.processFlows(mockConfig);
    expect(result).toBeUndefined();
    expect(apiPost).toHaveBeenCalled();
  });

  test('should handle flows with multiple pages', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
      ReportnetFlowsListId: 'flows-list-id',
      ObligationsListId: 'obligations-list-id',
      Reportnet3DataflowUrl: 'https://api.reportnet3.eu/',
      Reportnet2DataflowPublicUrl: 'https://public.reportnet2.eu/',
    };

    process.env.REACT_APP_REPORTNET3_KEY = 'test-key';

    const mockCountries = ['RO'];
    const mockColumns = [{ name: 'Country', choice: { choices: mockCountries } }];

    const mockFlowsPage1 = [
      {
        id: 'flow-1',
        name: 'Flow 1',
        status: 'draft',
        showPublicInfo: true,
        releasable: true,
        representatives: [],
        releasedDates: [],
        reportingDatasets: [],
      },
    ];
    const mockFlowsPage2 = [
      {
        id: 'flow-2',
        name: 'Flow 2',
        status: 'draft',
        showPublicInfo: true,
        releasable: true,
        representatives: [],
        releasedDates: [],
        reportingDatasets: [],
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('/columns')) {
        return Promise.resolve({
          success: true,
          data: { value: mockColumns },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    axios.default.request
      .mockResolvedValueOnce({
        data: {
          totalRecords: 2,
          dataflows: mockFlowsPage1,
        },
      })
      .mockResolvedValueOnce({
        data: {
          totalRecords: 2,
          dataflows: mockFlowsPage2,
        },
      });

    utils.capitalize.mockImplementation((str) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });
    apiPost.mockResolvedValue({ success: true });

    const result = await processor.processFlows(mockConfig);
    expect(result).toBeUndefined();
    expect(axios.default.request).toHaveBeenCalledTimes(2);
  });

  test('should handle flows with non-draft status', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
      ReportnetFlowsListId: 'flows-list-id',
      ObligationsListId: 'obligations-list-id',
      Reportnet3DataflowUrl: 'https://api.reportnet3.eu/',
      Reportnet2DataflowPublicUrl: 'https://public.reportnet2.eu/',
    };

    process.env.REACT_APP_REPORTNET3_KEY = 'test-key';

    const mockCountries = ['RO'];
    const mockColumns = [{ name: 'Country', choice: { choices: mockCountries } }];

    const mockFlows = [
      {
        id: 'flow-1',
        name: 'Flow 1',
        status: 'published',
        showPublicInfo: true,
        releasable: true,
        representatives: [],
        releasedDates: [],
        reportingDatasets: [],
      },
      {
        id: 'flow-2',
        name: 'Flow 2',
        status: 'draft',
        showPublicInfo: false,
        releasable: true,
        representatives: [],
        releasedDates: [],
        reportingDatasets: [],
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('/columns')) {
        return Promise.resolve({
          success: true,
          data: { value: mockColumns },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    axios.default.request.mockResolvedValue({
      data: {
        totalRecords: 2,
        dataflows: mockFlows,
      },
    });

    const result = await processor.processFlows(mockConfig);
    expect(result).toBeUndefined();
    expect(apiPost).not.toHaveBeenCalled();
  });

  test('should handle flows with non-releasable status', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
      ReportnetFlowsListId: 'flows-list-id',
      ObligationsListId: 'obligations-list-id',
      Reportnet3DataflowUrl: 'https://api.reportnet3.eu/',
      Reportnet2DataflowPublicUrl: 'https://public.reportnet2.eu/',
    };

    process.env.REACT_APP_REPORTNET3_KEY = 'test-key';

    const mockCountries = ['RO'];
    const mockColumns = [{ name: 'Country', choice: { choices: mockCountries } }];

    const mockFlows = [
      {
        id: 'flow-1',
        name: 'Flow 1',
        status: 'draft',
        showPublicInfo: true,
        releasable: false,
        representatives: [],
        releasedDates: [],
        reportingDatasets: [],
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('/columns')) {
        return Promise.resolve({
          success: true,
          data: { value: mockColumns },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    axios.default.request.mockResolvedValue({
      data: {
        totalRecords: 1,
        dataflows: mockFlows,
      },
    });

    utils.capitalize.mockImplementation((str) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    const result = await processor.processFlows(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle Reportnet3 API errors', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
      ReportnetFlowsListId: 'flows-list-id',
      ObligationsListId: 'obligations-list-id',
      Reportnet3DataflowUrl: 'https://api.reportnet3.eu/',
      Reportnet2DataflowPublicUrl: 'https://public.reportnet2.eu/',
    };

    process.env.REACT_APP_REPORTNET3_KEY = 'test-key';

    const mockCountries = ['RO'];
    const mockColumns = [{ name: 'Country', choice: { choices: mockCountries } }];

    apiGet.mockImplementation((url) => {
      if (url.includes('/columns')) {
        return Promise.resolve({
          success: true,
          data: { value: mockColumns },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    axios.default.request.mockRejectedValue(new Error('Reportnet3 API Error'));

    const result = await processor.processFlows(mockConfig);
    expect(result).toBeUndefined();
  });

  test('should handle flow removal', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
      ReportnetFlowsListId: 'flows-list-id',
      ObligationsListId: 'obligations-list-id',
      Reportnet3DataflowUrl: 'https://api.reportnet3.eu/',
      Reportnet2DataflowPublicUrl: 'https://public.reportnet2.eu/',
    };

    process.env.REACT_APP_REPORTNET3_KEY = 'test-key';

    const mockCountries = ['RO'];
    const mockColumns = [{ name: 'Country', choice: { choices: mockCountries } }];

    const mockSpFlows = [
      {
        id: '1',
        fields: {
          DataflowId: 'flow-123',
          Country: 'RO',
          DataflowName: 'Flow to Remove',
        },
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('/columns')) {
        return Promise.resolve({
          success: true,
          data: { value: mockColumns },
        });
      } else if (url.includes('flows-list-id')) {
        return Promise.resolve({
          success: true,
          data: { value: mockSpFlows },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    axios.default.request.mockResolvedValue({
      data: {
        totalRecords: 0,
        dataflows: [],
      },
    });

    apiDelete.mockResolvedValue({ success: true });

    const result = await processor.processFlows(mockConfig);
    expect(result).toBeUndefined();
    expect(apiDelete).toHaveBeenCalled();
  });

  test('should handle flows with missing obligation data', async () => {
    const mockConfig = {
      UserListId: 'user-list-id',
      ReportnetFlowsListId: 'flows-list-id',
      ObligationsListId: 'obligations-list-id',
      Reportnet3DataflowUrl: 'https://api.reportnet3.eu/',
      Reportnet2DataflowPublicUrl: 'https://public.reportnet2.eu/',
    };

    process.env.REACT_APP_REPORTNET3_KEY = 'test-key';

    const mockCountries = ['RO'];
    const mockColumns = [{ name: 'Country', choice: { choices: mockCountries } }];

    const mockFlows = [
      {
        id: 'flow-123',
        name: 'Test Flow',
        status: 'draft',
        showPublicInfo: true,
        releasable: true,
        obligation: null, // No obligation
        representatives: [],
        releasedDates: [],
        reportingDatasets: [],
      },
    ];

    apiGet.mockImplementation((url) => {
      if (url.includes('/columns')) {
        return Promise.resolve({
          success: true,
          data: { value: mockColumns },
        });
      }
      return Promise.resolve({
        success: true,
        data: { value: [] },
      });
    });

    axios.default.request.mockResolvedValue({
      data: {
        totalRecords: 1,
        dataflows: mockFlows,
      },
    });

    utils.capitalize.mockImplementation((str) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });
    apiPost.mockResolvedValue({ success: true });

    const result = await processor.processFlows(mockConfig);
    expect(result).toBeUndefined();
    expect(apiPost).toHaveBeenCalled();
  });
});
