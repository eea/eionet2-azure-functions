const { app } = require('@azure/functions');
const { getConfiguration } = require('./lib/configuration'),
  { processUserRemoval } = require('./processors/userRemovalProcessor');

app.http('UserRemoval', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'removeUsers',
  handler: async (request, context) => {
    context.log('Running User Removal for all records...');
    const applyRemove = request.query.get('applyRemove') == 'true';
    try {
      const config = await getConfiguration();
      if (config) {
        const result = await processUserRemoval(context, config, applyRemove);

        if (result && !applyRemove) {
          const stringResult = result.map((u) => `${u.fields.Email}`).join('; ');
          return {
            body: `Function UserRemoval executed successfully. No user was removed. User available for delete: ${stringResult}.`,
            status: 200,
          };
        } else if (applyRemove) {
          return {
            body: `Function UserRemoval executed successfully. The removed users were logged in the Logging list`,
            status: 200,
          };
        }
      }
    } catch (err) {
      context.error('Error in UserRemoval:', err.message);
    }

    return {
      body: `Function UserRemoval executed successfully. No users available fore removal`,
      status: 200,
    };
  },
});
