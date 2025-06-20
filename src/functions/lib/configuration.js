
const { apiGet } = require("./provider"),
    { apiConfigWithSite } = require("./graphClient");

async function getConfiguration() {
    const configListId = process.env.CONFIGURATION_LIST_ID;
    let _configuration = {};
    try {
        const response = await apiGet(apiConfigWithSite.uri + '/lists/' + configListId + '/items?$expand=fields');
        if (response.success) {
            response.data.value.forEach(function (item) {
                _configuration[item.fields.Title] = item.fields.Value;
            });
            return _configuration;
        }
        return undefined;
    } catch (err) {
        console.log(err);
        return undefined;
    }
}

module.exports = {
    getConfiguration: getConfiguration
}