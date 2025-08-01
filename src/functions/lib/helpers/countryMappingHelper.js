const { apiGet } = require('../provider'),
  { apiConfigWithSite } = require('../../lib/graphClient');

async function initialize(configuration) {
  !countryMapping && (await getCountryCodeMappingsList(configuration));
}

let countryMapping;
async function getCountryCodeMappingsList(configuration) {
  if (!countryMapping) {
    countryMapping = {};

    const response = await apiGet(
      `${apiConfigWithSite.uri}/lists/${configuration.CountryCodeMappingListId}/items?$expand=fields`,
    );
    response?.data?.value.forEach(
      (mapping) => (countryMapping[mapping.fields.Title] = mapping.fields.CountryName),
    );
  }
  return countryMapping;
}

function getCountryName(countryCode) {
  return countryMapping?.[countryCode];
}

module.exports = {
  initialize: initialize,
  getCountryName: getCountryName,
};
