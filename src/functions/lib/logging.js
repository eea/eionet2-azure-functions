const axios = require('axios'),
  { getAccessToken, apiConfigWithSite } = require("./graphClient")

async function info(configuration, message, apiPath, data, jobName, action, affectedUser) {
  console.log(message);
  const token = await getAccessToken();
  const options = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
  const jobTitle = jobName || 'Eionet2-Azure-Jobs';
  let fields = {
    fields: {
      ApplicationName: jobTitle,
      ApiPath: apiPath,
      ApiData: JSON.stringify(data),
      Title: jobTitle + ' - ' + message,
      Logtype: 'Info',
      Timestamp: new Date(),
      Action: action,
      AffectedUser: affectedUser,
    },
  };
  const path = apiConfigWithSite.uri + 'lists/' + configuration.LoggingListId + '/items';

  try {
    const response = await axios.default.post(path, fields, options);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.log(error);
    return {
      success: false,
      error: error,
    };
  }
}

async function error(configuration, error, jobName, message, affectedUser) {
  console.log(error);
  const token = await getAccessToken();
  const options = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  let innerMessage = message;
  //missing index error
  if (error.response?.data?.message?.includes('HonorNonIndexedQueriesWarningMayFailRandomly')) {
    innerMessage = error.response?.data?.message;
  }

  let fields = {
    fields: {
      ApplicationName: jobName || 'Eionet2-Azure-Jobs',
      ApiData: JSON.stringify(error),
      Title: innerMessage ?? error.toString(),
      Logtype: 'Error',
      Timestamp: new Date(),
      AffectedUser: affectedUser,
    },
  };
  const path = apiConfigWithSite.uri + 'lists/' + configuration.LoggingListId + '/items';

  try {
    const response = await axios.default.post(path, fields, options);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.log(error);
    return {
      success: false,
      error: error,
    };
  }
}

module.exports = {
  info: info,
  error: error,
};
