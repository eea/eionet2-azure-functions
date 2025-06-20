const { app } = require('@azure/functions');
const { getConfiguration } = require("./lib/configuration"),
    { processUsers } = require("./processors/userNamesProcessor")

app.timer('UserNames', {
    schedule: '*/1 * * * *',
    handler: async (myTimer, context) => {
        context.log("Running UserNames...");

        try {
            const config = await getConfiguration();
            if (config) {
                await processUsers(config);
            }
        } catch (err) {
            context.error("Error in UserNames:", err.message);
        }
    }
});
