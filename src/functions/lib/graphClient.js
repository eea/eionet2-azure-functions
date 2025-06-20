// lib/graphClient.js
const { ClientSecretCredential } = require("@azure/identity");

const apiConfig = {
    uri: process.env.GRAPH_ENDPOINT + '/beta/',
};

const apiConfigWithSite = {
    uri: process.env.GRAPH_ENDPOINT + '/beta/sites/' + process.env.SHAREPOINT_SITE_ID + '/',
};

const apiConfigWithSecondarySite = {
    uri: process.env.GRAPH_ENDPOINT + '/beta/sites/' + process.env.SECONDARY_SHAREPOINT_SITE_ID + '/',
};
getAccessToken = async () => {
    const credential = new ClientSecretCredential(
        process.env.TENANT_ID,
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET
    );
    const scope = `${process.env.GRAPH_ENDPOINT}/.default`;
    const token = await credential.getToken(scope);
    return token.token;
};

module.exports = {
    apiConfig: apiConfig,
    apiConfigWithSite: apiConfigWithSite,
    apiConfigWithSecondarySite: apiConfigWithSecondarySite,
    getAccessToken: getAccessToken,
}
