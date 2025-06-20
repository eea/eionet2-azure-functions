const { app } = require('@azure/functions');
const axios = require("axios");
const { getAccessToken } = require("./lib/graphClient");

app.timer('SimpleTest', {
    schedule: '*/10 * * * *',
    handler: async (myTimer, context) => {
        context.log("Running GraphProcessor...");

        try {
            const token = await getAccessToken();
            const response = await axios.get("https://graph.microsoft.com/v1.0/users", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const users = response.data.value;
            context.log(`Fetched ${users.length} users.`);
        } catch (err) {
            context.error("Error in GraphProcessor:", err.message);
        }
    }
});
