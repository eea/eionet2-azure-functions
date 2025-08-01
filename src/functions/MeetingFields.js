const { app } = require('@azure/functions');
const { getConfiguration } = require("./lib/configuration"),
    { processMeetings } = require("./processors/meetingFieldsProcessor")

app.timer('MeetingFields', {
    schedule: process.env.MEETINGFIELDS_SCHEDULE || '0 0/10 * * * *',  // fallback
    handler: async (myTimer, context) => {
        context.log("Running MeetingFields...");

        try {
            const config = await getConfiguration();
            if (config) {
                await processMeetings(config);
            }
        } catch (err) {
            context.error("Error in MeetingFields:", err.message);
        }
    }
});
