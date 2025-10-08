const processor = require('./meetingAttendanceProcessor');

// Mock all dependencies
jest.mock('../lib/logging', () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

jest.mock('../lib/provider', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
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
  getLookupADUserId: jest.fn(),
  getADUser: jest.fn(),
  getUserByMail: jest.fn(),
}));

jest.mock('../lib/helpers/utils', () => ({
  parseJoinMeetingId: jest.fn(),
}));

jest.mock('date-and-time', () => ({
  format: jest.fn(),
}));

// Get the mocked functions
const { apiGet, apiPost, apiPatch } = require('../lib/provider');
const userHelper = require('../lib/helpers/userHelper');
const utils = require('../lib/helpers/utils');

const meetingObject = {
    createdBy: {
      user: {
        email: 'mg.nicolae@7lcpdm.onmicrosoft.com',
        id: '3c45ac4d-e740-4681-aacd-f558dde7cf2d',
        displayName: 'Gabriel-Mihai Nicolae (MK)',
      },
    },
    fields: {
      id: '2',
      ContentType: 'Item',
      Title: 'First EEA-Eionet editorial meeting',
      Modified: '2022-06-22T12:23:56Z',
      Created: '2022-06-07T14:25:47Z',
      AuthorLookupId: '10',
      EditorLookupId: '1073741822',
      _UIVersionString: '21.0',
      Attachments: false,
      Edit: '',
      LinkTitleNoMenu: 'First EEA-Eionet editorial meeting',
      LinkTitle: 'First EEA-Eionet editorial meeting',
      ItemChildCount: '0',
      FolderChildCount: '0',
      _ComplianceFlags: '',
      _ComplianceTag: '',
      _ComplianceTagWrittenTime: '',
      _ComplianceTagUserId: '',
      AppEditorLookupId: '30',
      Meetingstart: '2022-01-28T09:00:00Z',
      Meetingend: '2022-01-28T10:30:00Z',
      MeetingmanagerLookupId: '30',
      Group: 'Communications',
      JoinMeetingId: '256 856 969',
      Linktofolder: {
        Description: 'Meeting folder',
        Url: 'https://eea1.sharepoint.com/:f:/r/teams/-EXT-Eionet/Shared%20Documents/Communications/Editorial%20meetings/First%20Editorial%20Meeting%20-%2028-01-22?csf=1&web=1&e=aaQMOE',
      },
    },
  },
  attedanceRecord = {
    id: 'ae40523c-d750-41f5-9873-6346b474e5fb',
    emailAddress: 'test@test.com',
    identity: {
      displayName: 'Test Display Name',
    },
  };

describe('meetingAttendanceProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('processMeetings', async () => {
    const mockConfig = {
      MeetingListId: 'meeting-list-id',
      MeetingParticipantsListId: 'participants-list-id',
    };

    // Mock the API calls
    apiGet.mockImplementation((url) => {
      if (url.includes('meeting-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [meetingObject],
          },
        });
      } else if (url.includes('onlineMeetings?$filter=joinMeetingIdSettings/JoinMeetingId eq')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                id: '9950274a-ba4b-40e1-92d8-8468cced65e3',
              },
            ],
          },
        });
      } else if (
        url.includes('onlineMeetings/9950274a-ba4b-40e1-92d8-8468cced65e3/attendanceReports') &&
        !url.includes('attendanceRecords')
      ) {
        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                id: 'ae40523c-d750-41f5-9873-6346b474e5fb',
              },
            ],
          },
        });
      } else if (url.includes('attendanceRecords')) {
        return Promise.resolve({
          success: true,
          data: {
            attendanceRecords: [attedanceRecord],
          },
        });
      } else if (url.includes('participants-list-id') && url.includes('MeetingtitleLookupId eq')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [],
          },
        });
      } else if (url.includes('items/2') && !url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: {
            fields: {
              Processed: false,
              Processedreports: '',
            },
          },
        });
      }
      return Promise.resolve({ success: false, data: null });
    });

    apiPost.mockImplementation(() =>
      Promise.resolve({
        success: true,
        data: { id: 'new-participant-id' },
      }),
    );

    apiPatch.mockImplementation(() =>
      Promise.resolve({
        success: true,
        data: { id: '2' },
      }),
    );

    // Mock helper functions
    userHelper.getLookupADUserId.mockResolvedValue('user-id-123');
    userHelper.getADUser.mockResolvedValue({ mail: 'test@example.com' });
    userHelper.getUserByMail.mockResolvedValue({ country: 'RO' });
    utils.parseJoinMeetingId.mockReturnValue('256 856 969');

    const result = await processor.processMeetings(mockConfig);
    expect(result).toBeUndefined();
  });

  test('no attendace reports', async () => {
    const mockConfig = {
      MeetingListId: 'meeting-list-id',
      MeetingParticipantsListId: 'participants-list-id',
    };

    apiGet.mockImplementation((url) => {
      if (url.includes('meeting-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [meetingObject],
          },
        });
      } else if (url.includes('onlineMeetings?$filter=joinMeetingIdSettings/JoinMeetingId eq')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [
              {
                id: '9950274a-ba4b-40e1-92d8-8468cced65e3',
              },
            ],
          },
        });
      } else if (
        url.includes('onlineMeetings/9950274a-ba4b-40e1-92d8-8468cced65e3/attendanceReports')
      ) {
        return Promise.resolve({
          success: true,
          data: {
            value: [],
          },
        });
      } else if (url.includes('items/2') && !url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: {
            fields: {
              Processed: false,
              Processedreports: '',
            },
          },
        });
      }
      return Promise.resolve({ success: false, data: null });
    });

    userHelper.getLookupADUserId.mockResolvedValue('user-id-123');
    userHelper.getADUser.mockResolvedValue({ mail: 'test@example.com' });
    utils.parseJoinMeetingId.mockReturnValue('256 856 969');

    const result = await processor.processMeetings(mockConfig);
    expect(result).toBeUndefined();
  });

  test('missing meeting manager', async () => {
    const mockConfig = {
      MeetingListId: 'meeting-list-id',
      MeetingParticipantsListId: 'participants-list-id',
    };

    const meetingWithoutManager = {
      createdBy: {
        user: {
          email: 'mg.nicolae@7lcpdm.onmicrosoft.com',
          id: '3c45ac4d-e740-4681-aacd-f558dde7cf2d',
          displayName: 'Gabriel-Mihai Nicolae (MK)',
        },
      },
      fields: {
        id: '2',
        Title: 'Test Meeting',
        MeetingmanagerLookupId: null,
        JoinMeetingId: '256 856 969',
      },
    };

    apiGet.mockImplementation((url) => {
      if (url.includes('meeting-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [meetingWithoutManager],
          },
        });
      }
      return Promise.resolve({ success: false, data: null });
    });

    userHelper.getLookupADUserId.mockResolvedValue(null);
    userHelper.getADUser.mockResolvedValue({ mail: 'test@example.com' });
    utils.parseJoinMeetingId.mockReturnValue('256 856 969');

    const result = await processor.processMeetings(mockConfig);
    expect(result).toBeUndefined();
  });

  test('missing meeting id', async () => {
    const mockConfig = {
      MeetingListId: 'meeting-list-id',
      MeetingParticipantsListId: 'participants-list-id',
    };

    const meetingWithoutId = {
      createdBy: {
        user: {
          email: 'mg.nicolae@7lcpdm.onmicrosoft.com',
          id: '3c45ac4d-e740-4681-aacd-f558dde7cf2d',
          displayName: 'Gabriel-Mihai Nicolae (MK)',
        },
      },
      fields: {
        Title: 'Test Meeting',
        MeetingmanagerLookupId: '30',
        JoinMeetingId: '256 856 969',
      },
    };

    apiGet.mockImplementation((url) => {
      if (url.includes('meeting-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [meetingWithoutId],
          },
        });
      }
      return Promise.resolve({ success: false, data: null });
    });

    userHelper.getLookupADUserId.mockResolvedValue('user-id-123');
    userHelper.getADUser.mockResolvedValue({ mail: 'test@example.com' });
    utils.parseJoinMeetingId.mockReturnValue('256 856 969');

    const result = await processor.processMeetings(mockConfig);
    expect(result).toBeUndefined();
  });

  test('wrong combination id and manager', async () => {
    const mockConfig = {
      MeetingListId: 'meeting-list-id',
      MeetingParticipantsListId: 'participants-list-id',
    };

    apiGet.mockImplementation((url) => {
      if (url.includes('meeting-list-id') && url.includes('items?$expand=fields')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [meetingObject],
          },
        });
      } else if (url.includes('onlineMeetings?$filter=joinMeetingIdSettings/JoinMeetingId eq')) {
        return Promise.resolve({
          success: true,
          data: {
            value: [],
          },
        });
      }
      return Promise.resolve({ success: false, data: null });
    });

    userHelper.getLookupADUserId.mockResolvedValue('user-id-123');
    userHelper.getADUser.mockResolvedValue({ mail: 'test@example.com' });
    utils.parseJoinMeetingId.mockReturnValue('256 856 969');

    const result = await processor.processMeetings(mockConfig);
    expect(result).toBeUndefined();
  });
});
