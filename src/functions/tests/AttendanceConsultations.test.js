function setupFunction() {
  jest.resetModules();

  let registered;
  jest.doMock('@azure/functions', () => ({
    app: {
      timer: jest.fn((name, definition) => {
        registered = { name, definition };
      }),
    },
  }));

  jest.doMock('../lib/configuration', () => ({
    getConfiguration: jest.fn(),
  }));

  jest.doMock('../processors/meetingAttendanceProcessor', () => ({
    processMeetings: jest.fn(),
  }));

  jest.doMock('../processors/consultationRespondantsProcessor', () => ({
    processConsultations: jest.fn(),
  }));

  require('../AttendanceConsultations');

  const { getConfiguration } = require('../lib/configuration');
  const { processMeetings } = require('../processors/meetingAttendanceProcessor');
  const { processConsultations } = require('../processors/consultationRespondantsProcessor');

  return {
    timerName: registered.name,
    handler: registered.definition.handler,
    getConfiguration,
    processMeetings,
    processConsultations,
  };
}

describe('AttendanceConsultations function', () => {
  test('runs both processors when configuration exists', async () => {
    const { timerName, handler, getConfiguration, processMeetings, processConsultations } =
      setupFunction();
    const config = { MeetingListId: 'm', ConsultationListId: 'c' };
    const context = { log: jest.fn(), error: jest.fn() };

    getConfiguration.mockResolvedValue(config);
    processMeetings.mockResolvedValue();
    processConsultations.mockResolvedValue();

    await handler({}, context);

    expect(timerName).toBe('AttendanceConsultations');
    expect(processMeetings).toHaveBeenCalledWith(config);
    expect(processConsultations).toHaveBeenCalledWith(config);
  });

  test('does nothing when configuration is missing', async () => {
    const { handler, getConfiguration, processMeetings, processConsultations } = setupFunction();
    const context = { log: jest.fn(), error: jest.fn() };

    getConfiguration.mockResolvedValue(undefined);

    await handler({}, context);

    expect(processMeetings).not.toHaveBeenCalled();
    expect(processConsultations).not.toHaveBeenCalled();
  });

  test('logs function error', async () => {
    const { handler, getConfiguration, processMeetings } = setupFunction();
    const context = { log: jest.fn(), error: jest.fn() };

    getConfiguration.mockResolvedValue({ MeetingListId: 'm' });
    processMeetings.mockRejectedValue(new Error('meetings failed'));

    await handler({}, context);

    expect(context.error).toHaveBeenCalledWith('Error in AttendanceConsultations:', 'meetings failed');
  });
});
