const processor = require('./meetingAttendanceProcessor');

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
    uri: 'https://graph.microsoft.com/v1.0/',
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

const logging = require('../lib/logging');
const { apiGet, apiPost, apiPatch } = require('../lib/provider');
const userHelper = require('../lib/helpers/userHelper');
const utils = require('../lib/helpers/utils');
const date = require('date-and-time');

const baseConfig = {
  MeetingListId: 'meeting-list-id',
  MeetingParticipantsListId: 'participants-list-id',
};

const meetingObject = {
  fields: {
    id: '2',
    Title: 'First EEA-Eionet editorial meeting',
    Meetingstart: '2022-01-28T09:00:00Z',
    Meetingend: '2022-01-28T10:30:00Z',
    MeetingmanagerLookupId: '30',
    JoinMeetingId: '256 856 969',
    Processedreports: '',
  },
};

const attendanceRecord = {
  id: 'ae40523c-d750-41f5-9873-6346b474e5fb',
  emailAddress: 'test@test.com',
  identity: {
    displayName: 'Test Display Name',
  },
};

function buildApiGet({
  meetings = [meetingObject],
  onlineMeetings = [{ id: 'online-meeting-id' }],
  attendanceReports = [{ id: 'report-1' }],
  attendanceDetails = { success: true, data: { attendanceRecords: [attendanceRecord] } },
  existingParticipants = [],
  meetingItem = { fields: { Processed: false, Processedreports: '' } },
  attendanceReportsSuccess = true,
  meetingLookupSuccess = true,
  participantsLookupSuccess = true,
}) {
  return jest.fn((url) => {
    if (url.includes('meeting-list-id') && url.includes('items?$expand=fields')) {
      return Promise.resolve({
        success: true,
        data: { value: meetings },
      });
    }

    if (url.includes("/onlineMeetings?$filter=joinMeetingIdSettings/JoinMeetingId eq '")) {
      return Promise.resolve({
        success: meetingLookupSuccess,
        data: { value: onlineMeetings },
        error: meetingLookupSuccess ? undefined : 'meeting lookup failed',
      });
    }

    if (
      url.includes('/onlineMeetings/online-meeting-id/attendanceReports') &&
      !url.includes('?$expand=attendanceRecords')
    ) {
      return Promise.resolve({
        success: attendanceReportsSuccess,
        data: { value: attendanceReports },
        error: attendanceReportsSuccess ? undefined : 'attendance reports failed',
      });
    }

    if (url.includes('/attendanceReports/') && url.includes('?$expand=attendanceRecords')) {
      return Promise.resolve(attendanceDetails);
    }

    if (url.includes('participants-list-id') && url.includes('MeetingtitleLookupId eq')) {
      return Promise.resolve({
        success: participantsLookupSuccess,
        data: { value: existingParticipants },
      });
    }

    if (url.endsWith('/lists/meeting-list-id/items/2')) {
      return Promise.resolve({
        success: true,
        data: meetingItem,
      });
    }

    return Promise.resolve({ success: false, data: null });
  });
}

describe('meetingAttendanceProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    date.format.mockReturnValue('2026-03-20T12:00:00');
    userHelper.getLookupADUserId.mockResolvedValue('user-id-123');
    userHelper.getADUser.mockResolvedValue({ mail: 'test@example.com' });
    userHelper.getUserByMail.mockResolvedValue({ country: 'RO' });
    utils.parseJoinMeetingId.mockReturnValue('256 856 969');
    apiPost.mockResolvedValue({ success: true, data: { id: 'new-participant-id' } });
    apiPatch.mockResolvedValue({ success: true, data: { id: '2' } });
  });

  test('creates a new participant and patches the meeting with processed reports', async () => {
    apiGet.mockImplementation(buildApiGet({}));

    await processor.processMeetings(baseConfig);

    expect(apiPost).toHaveBeenCalledWith(
      'https://test.sharepoint.com/sites/test/lists/participants-list-id/items',
      {
        fields: {
          Participantname: 'Test Display Name',
          Countries: 'RO',
          MeetingtitleLookupId: '2',
          EMail: 'test@test.com',
          Participated: true,
        },
      },
    );
    expect(apiPatch).toHaveBeenCalledWith(
      'https://test.sharepoint.com/sites/test/lists/meeting-list-id/items/2',
      {
        fields: {
          Processedreports: 'report-1',
          Processed: true,
        },
      },
    );
    expect(logging.info).toHaveBeenCalledWith(
      baseConfig,
      'Meeting updated succesfully : First EEA-Eionet editorial meeting',
      '',
      'report-1',
      'UpdateMeetingParticipants',
    );
  });

  test('updates an existing participant instead of creating a new one', async () => {
    apiGet.mockImplementation(
      buildApiGet({
        existingParticipants: [{ id: 'participant-1' }],
      }),
    );

    await processor.processMeetings(baseConfig);

    expect(apiPost).not.toHaveBeenCalled();
    expect(apiPatch).toHaveBeenCalledWith(
      'https://test.sharepoint.com/sites/test/lists/participants-list-id/items/participant-1',
      {
        fields: {
          Participated: true,
        },
      },
    );
  });

  test('skips already processed reports', async () => {
    apiGet.mockImplementation(
      buildApiGet({
        meetings: [
          {
            fields: {
              ...meetingObject.fields,
              Processedreports: 'report-1',
            },
          },
        ],
      }),
    );

    await processor.processMeetings(baseConfig);

    expect(apiPost).not.toHaveBeenCalled();
    expect(apiPatch).not.toHaveBeenCalled();
  });

  test('does not set country for eea addresses', async () => {
    apiGet.mockImplementation(
      buildApiGet({
        attendanceDetails: {
          success: true,
          data: {
            attendanceRecords: [
              {
                ...attendanceRecord,
                emailAddress: 'test@eea.europa.eu',
              },
            ],
          },
        },
      }),
    );

    await processor.processMeetings(baseConfig);

    expect(apiPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        fields: expect.not.objectContaining({
          Countries: 'RO',
        }),
      }),
    );
  });

  test('logs and skips processing when meeting manager is missing', async () => {
    apiGet.mockImplementation(
      buildApiGet({
        meetings: [
          {
            fields: {
              ...meetingObject.fields,
              MeetingmanagerLookupId: null,
            },
          },
        ],
      }),
    );
    userHelper.getLookupADUserId.mockResolvedValue(null);

    await processor.processMeetings(baseConfig);

    expect(logging.error).toHaveBeenCalledWith(
      baseConfig,
      'Missing meeting manager for meeting id: 2',
      'UpdateMeetingParticipants',
    );
    expect(apiPost).not.toHaveBeenCalled();
  });

  test('logs invalid join meeting id and does not continue', async () => {
    apiGet.mockImplementation(buildApiGet({}));
    utils.parseJoinMeetingId.mockReturnValue(undefined);

    await processor.processMeetings(baseConfig);

    expect(apiPost).not.toHaveBeenCalled();
    expect(apiPatch).not.toHaveBeenCalled();
    expect(logging.error).not.toHaveBeenCalled();
  });

  test('logs when meeting and organizer do not match', async () => {
    apiGet.mockImplementation(
      buildApiGet({
        onlineMeetings: [],
      }),
    );

    await processor.processMeetings(baseConfig);

    expect(logging.error).toHaveBeenCalledWith(
      baseConfig,
      'Meeting *ID:2* First EEA-Eionet editorial meeting and organizer test@example.com has wrong organizer specified.',
      'UpdateMeetingParticipants',
      undefined,
      'test@example.com',
    );
  });

  test('logs when attendance reports cannot be loaded', async () => {
    apiGet.mockImplementation(
      buildApiGet({
        attendanceReportsSuccess: false,
      }),
    );

    await processor.processMeetings(baseConfig);

    expect(logging.error).toHaveBeenCalledWith(
      baseConfig,
      'attendance reports failed',
      'UpdateMeetingParticipants',
      'Meeting *ID:2* First EEA-Eionet editorial meeting and organizer test@example.com has wrong organizer specified.',
      'test@example.com',
    );
  });

  test('logs when attendance report details cannot be loaded', async () => {
    apiGet.mockImplementation(
      buildApiGet({
        attendanceDetails: { success: false, data: null },
      }),
    );

    await processor.processMeetings(baseConfig);

    expect(logging.error).toHaveBeenCalledWith(
      baseConfig,
      'Unable to load attendanceRecords for meeting First EEA-Eionet editorial meeting and organizer with id user-id-123',
      'UpdateMeetingParticipants',
    );
  });

  test('does not patch the meeting when there are no attendance reports', async () => {
    apiGet.mockImplementation(
      buildApiGet({
        attendanceReports: [],
      }),
    );

    await processor.processMeetings(baseConfig);

    expect(apiPost).not.toHaveBeenCalled();
    expect(apiPatch).not.toHaveBeenCalled();
  });

  test('patches the meeting with empty processed reports when saving a participant fails', async () => {
    apiGet.mockImplementation(buildApiGet({}));
    apiPost.mockResolvedValue({ success: false, data: null });

    await processor.processMeetings(baseConfig);

    expect(logging.error).not.toHaveBeenCalled();
    expect(apiPatch).toHaveBeenCalledWith(
      'https://test.sharepoint.com/sites/test/lists/meeting-list-id/items/2',
      {
        fields: {
          Processedreports: '',
          Processed: true,
        },
      },
    );
  });

  test('does not patch the meeting when it is already up to date', async () => {
    apiGet.mockImplementation(
      buildApiGet({
        meetingItem: {
          fields: {
            Processed: true,
            Processedreports: 'report-1',
          },
        },
      }),
    );

    await processor.processMeetings(baseConfig);

    expect(apiPatch).toHaveBeenCalledTimes(0);
    expect(logging.info).not.toHaveBeenCalled();
  });

  test('returns an error when loading meetings throws', async () => {
    const failure = new Error('boom');
    apiGet.mockRejectedValue(failure);

    const result = await processor.processMeetings(baseConfig);

    expect(result).toBe(failure);
    expect(logging.error).toHaveBeenCalledWith(baseConfig, failure, 'UpdateMeetingParticipants');
  });
});
