const { app } = require('@azure/functions');
const { getConfiguration } = require("./lib/configuration"),
    { processFlows } = require("./processors/reportnet3FlowsProcessor")

app.timer('Reportnet3Flows', {
    schedule: process.env.REPORTNET3_SCHEDULE || '*/1 * * * *',  // fallback
    handler: async (myTimer, context) => {
        context.log("Running Reportnet3Flows...");

        try {
            const config = await getConfiguration();
            if (config) {
                await processFlows(config);
            }
        } catch (err) {
            context.error("Error in Reportnet3Flows:", err.message);
        }
    }
});
