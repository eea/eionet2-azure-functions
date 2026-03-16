const logging = require('../lib/logging'),
  { apiGet, apiPatch, apiDelete } = require('../lib/provider'),
  { apiConfigWithSite, apiConfig } = require('../lib/graphClient'),
  userHelper = require('../lib/helpers/userHelper'),
  userGroupHelper = require('../lib/helpers/userGroupHelper'),
  mappingHelper = require('../lib/helpers/mappingHelper'),
  tagHelper = require('../lib/helpers/tagHelper'),
  jobName = 'UserRemoval';

//Entry point function for processing users that have signed it in Eionet
let configuration;
let users2Delete = [];
async function processUserRemoval(context, config, applyRemove) {
  configuration = config;
  const filterDate = new Date(
    new Date().setDate(new Date().getDate() - configuration.RemoveNonSignedInUserNoOfDays),
  );
  try {
    await mappingHelper.initialize(configuration);
    await tagHelper.initialize(jobName, configuration);

    const users = await loadList(configuration.UserListId),
      organisations = await loadList(configuration.OrganisationListId);
    const signInActivities = await loadSignInActivities();
    for (const user of users) {
      const userFields = user.fields,
        activity = signInActivities.find((sa) => sa.id == userFields.ADUserId);
      if (
        shouldRemoveUser(
          user,
          activity,
          filterDate,
          new Date(configuration.UserRemovalLastSignInDateTime),
        )
      ) {
        user.lastSignInDateTime = activity?.signInActivity?.lastSignInDateTime;
        user.lastSuccessfulSignInDateTime = activity?.signInActivity?.lastSuccessfulSignInDateTime;
        user.organisationName = organisations?.find(
          (o) => o.id == userFields.OrganisationLookupId,
        )?.fields.Title;
        users2Delete.push(user);
      }
    }
    if (users2Delete.length > 0) {
      if (applyRemove) {
        for (const user of users2Delete) {
          await deleteUser(user);
        }
      } else {
        return users2Delete;
      }
    } else {
      console.log('No users to remove.');
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return error;
  }
}

function shouldRemoveUser(user, activity, filterDate, lastSignInDate) {
  const userFields = user.fields,
    isSignedIn = userFields.SignedIn != null && !!userFields.SignedIn && !!activity?.signInActivity;

  if (isSignedIn) {
    return (
      activity.signInActivity.lastSuccessfulSignInDateTime !== null &&
      new Date(activity.signInActivity.lastSuccessfulSignInDateTime) < lastSignInDate
    );
  } else {
    return new Date(user.createdDateTime) < filterDate;
  }
}

async function loadList(listId) {
  let path = encodeURI(
      apiConfigWithSite.uri + 'lists/' + listId + '/items?$expand=fields&$top=999',
    ),
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

async function loadSignInActivities() {
  let path = `${apiConfig.uri}users?select=id,displayName,signInActivity`,
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

async function deleteUserGroup(groupId, userId) {
  await apiDelete(`${apiConfig.uri}/groups/${groupId}/members/${userId}/$ref`);
}

async function deleteUser(user) {
  const userFields = user.fields,
    userId = userFields.ADUserId;

  const adUser = await userHelper.getADUser(userId);
  if (adUser) {
    const userMappings = mappingHelper
      .getMappings()
      .filter(
        (m) =>
          userFields.Membership?.includes(m.Membership) ||
          userFields.OtherMemberships?.includes(m.Membership),
      );

    const userGroupIds = userGroupHelper.getDistinctGroupsIds(userMappings);
    //if NFP add specific groups if not already present.
    if (userFields.NFP) {
      !userGroupIds.includes(configuration.NFPGroupId) &&
        userGroupIds.push(configuration.NFPGroupId);
      !userGroupIds.includes(configuration.MainEionetGroupId) &&
        userGroupIds.push(configuration.MainEionetGroupId);
    }

    const existingGroups = await userGroupHelper.getExistingGroups(userId, userGroupIds);
    try {
      for (const groupId of existingGroups) {
        await deleteUserGroup(groupId, userId);
      }

      await apiPatch(`${apiConfig.uri}/users/${userId}`, {
        displayName: userFields.Title,
        department: 'Ex-Eionet',
        country: null,
      });
    } catch (err) {
      console.log(err);
      return;
    }
  } else {
    console.log("User doesn't have a valid ADUserId. Nothing to remove from AD.");
  }
  try {
    await apiDelete(`${apiConfigWithSite.uri}lists/${configuration.UserListId}/items/${user.id}`);
    await logging.info(
      configuration,
      'User was removed from list.',
      '',
      userFields,
      jobName,
      'Remove user',
      userFields.Email,
    );
  } catch (err) {
    console.log(err);
    return;
  }
}

module.exports = {
  shouldRemoveUser: shouldRemoveUser,
  processUserRemoval: processUserRemoval,
};
