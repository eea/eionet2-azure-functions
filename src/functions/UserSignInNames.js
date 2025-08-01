const { app } = require('@azure/functions');
const { getConfiguration } = require("./lib/configuration"),
    { processSignedInUsers } = require("./processors/signedInUsersProcessor"),
    { processUsers } = require("./processors/userNamesProcessor");

app.timer('UserSignInNames', {
    schedule: process.env.USERSIGNINNAMES_SCHEDULE || '0 0 */5 * * *', // fallback
    handler: async (myTimer, context) => {
        context.log("Running UserSignInNames...");

        try {
            const config = await getConfiguration();
            if (config) {
                context.log("Running SignedInUsersProcessor...");
                await processSignedInUsers(config);
                context.log("Running UserNamesProcessor...");
                await processUsers(config);

                // context.log("Running UserLastSignInProcessor...");
                // await processUserLastSignIn(config);
            }
        } catch (err) {
            context.error("Error in UserSignInNames:", err.message);
        }
    }
});
