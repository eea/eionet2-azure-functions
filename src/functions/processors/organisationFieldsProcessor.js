
const logging = require('../lib/logging'),
  { apiGet, apiPatch, } = require('../lib/provider'),
  { apiConfigWithSite, apiConfig } = require('../lib/graphClient'),
  userHelper = require('../lib/helpers/userHelper'),
  utils = require('../lib/helpers/utils'),
  jobName = 'UpdateOrganisationFields';

let configuration,
  //if set to true ignores filters and updates all meetings.
  _updateAll = false;

//Entry point function for meeting fields processing functionality
async function processOrganisations(config, context) {
  configuration = config;
  try {
    const organisations = await loadRecords(configuration.OrganisationListId),
      users = await loadRecords(configuration.UserListId);

    context.log('Number of organisations to process for fields update: ' + organisations.length);
    for (const organisation of organisations) {
      await processOrganisation(context, organisation, users.filter(u => u.fields.OrganisationLookupId == organisation.id)?.length);
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return error;
  }
}

async function loadRecords(listId) {
  let path = encodeURI(`${apiConfigWithSite.uri}lists/${listId}/items?$expand=fields&$top=999`),
    result = [];

  while (path) {
    const response = await apiGet(path, true);
    if (response.success) {
      result = result.concat(response.data.value);
      path = response.data['@odata.nextLink'];
    } else {
      path = undefined;
    }
  }

  return result;
}

//Update organisation members count
async function processOrganisation(context, organisation, userCount) {
  try {
    const path = `${apiConfigWithSite.uri}lists/${configuration.OrganisationListId}/items/${organisation.id}`;
    let response = await apiGet(path);
    const organisationFields = response.data.fields;

    if (response.success) {
      if (organisationFields.Members !== userCount) {
        response = await apiPatch(path, {
          fields: {
            Members: userCount
          },
        });
        if (response.success) {
          context.log('Organisation fields updated succesfully : ' + organisationFields.Title);
          return response.data;
        }
      }
    } else {
      console.log(`No changes to organisation ${organisationFields.Title}. Skip patch`);
    }

    return undefined;
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return undefined;
  }
}

module.exports = {
  processOrganisations: processOrganisations,
};
