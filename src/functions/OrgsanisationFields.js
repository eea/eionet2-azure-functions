const { app } = require('@azure/functions');
const { getConfiguration } = require('./lib/configuration');
const { processOrganisations } = require('./processors/organisationFieldsProcessor');

app.timer('OrganisationFields', {
  schedule: process.env.ORGANISATIONFIELDS_SCHEDULE || '0 0 2 * * *', // fallback
  handler: async (myTimer, context) => {
    context.log('Running OrganisationFields...');

    try {
      const config = await getConfiguration();
      if (config) {
        await processOrganisations(config, context);
      }
    } catch (err) {
      context.error('Error in OrganisationFields:', err.message);
    }
  },
});
