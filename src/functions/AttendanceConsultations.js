const { app } = require('@azure/functions');
const { getConfiguration } = require("./lib/configuration"),
    { processMeetings } = require("./processors/meetingAttendanceProcessor"),
    { processConsultations } = require("./processors/consultationRespondantsProcessor");

app.timer('AttendanceConsultations', {
    schedule: process.env.ATTENDANCE_CONS_SCHEDULE || '0 0 */3 * * *',  // fallback
    handler: async (myTimer, context) => {
        try {
            const config = await getConfiguration();
            if (config) {
                context.log("Running MeetingAttendanceProcessor...");
                await processMeetings(config);

                context.log("Running ConsultationRespondantsProcessor...");
                await processConsultations(config);
            }
        } catch (err) {
            context.error("Error in AttendanceConsultations:", err.message);
        }
    }
});
