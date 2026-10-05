const { app } = require('@azure/functions');
const { getConfiguration } = require('./lib/configuration'),
  { processLoggingCleanup } = require('./processors/loggingCleanupProcessor');

app.timer('LoggingCleanup', {
  schedule: process.env.LOGGINGCLEANUP_SCHEDULE || '0 0 3 * * 0', // weekly, Sunday 03:00
  handler: async (myTimer, context) => {
    context.log('Running LoggingCleanup...');

    try {
      const config = await getConfiguration();
      if (config) {
        await processLoggingCleanup(config, context);
      }
    } catch (err) {
      context.error('Error in LoggingCleanup:', err.message);
    }
  },
});
