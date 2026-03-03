function setupTagHelper() {
  jest.resetModules();

  jest.doMock('../../lib/logging', () => ({
    info: jest.fn(),
  }));

  jest.doMock('../../lib/provider', () => ({
    apiGet: jest.fn(),
    apiPost: jest.fn(),
  }));

  jest.doMock('../../lib/graphClient', () => ({
    apiConfig: {
      uri: 'https://graph.test/v1.0',
    },
  }));

  jest.doMock('./countryMappingHelper', () => ({
    initialize: jest.fn(),
    getCountryName: jest.fn(),
  }));

  const tagHelper = require('./tagHelper');
  const logging = require('../../lib/logging');
  const { apiGet, apiPost } = require('../../lib/provider');
  const countryMappingHelper = require('./countryMappingHelper');

  return {
    tagHelper,
    logging,
    apiGet,
    apiPost,
    countryMappingHelper,
  };
}

describe('tagHelper', () => {
  test('initializes country mapping helper', async () => {
    const { tagHelper, countryMappingHelper } = setupTagHelper();
    const config = { MainEionetGroupId: 'main-group' };

    await tagHelper.initialize('UserMembership', config);

    expect(countryMappingHelper.initialize).toHaveBeenCalledWith(config);
  });

  test('skips applyTags when helper is not initialized', async () => {
    const { tagHelper, apiGet, apiPost } = setupTagHelper();

    await tagHelper.applyTags(
      { ADUserId: 'user-id', Country: 'RO', Email: 'test@example.com' },
      [{ O365GroupId: 'team-id', Tag: 'Member' }],
      true,
    );

    expect(apiGet).not.toHaveBeenCalled();
    expect(apiPost).not.toHaveBeenCalled();
  });

  test('skips applyTags when user has no AD user id', async () => {
    const { tagHelper, apiGet, apiPost, countryMappingHelper } = setupTagHelper();

    await tagHelper.initialize('UserMembership', { MainEionetGroupId: 'main-group' });
    countryMappingHelper.getCountryName.mockReturnValue('Romania');

    await tagHelper.applyTags(
      { Country: 'RO', Email: 'test@example.com' },
      [{ O365GroupId: 'team-id', Tag: 'Member' }],
      true,
    );

    expect(apiGet).not.toHaveBeenCalled();
    expect(apiPost).not.toHaveBeenCalled();
  });

  test('creates new tags and logs success messages', async () => {
    const { tagHelper, logging, apiGet, apiPost, countryMappingHelper } = setupTagHelper();

    await tagHelper.initialize('UserMembership', { MainEionetGroupId: 'main-group' });
    countryMappingHelper.getCountryName.mockReturnValue('Romania');
    apiGet.mockResolvedValue({ success: true, data: { value: [] } });
    apiPost.mockResolvedValue({ success: true, data: {} });

    await tagHelper.applyTags(
      {
        ADUserId: 'user-id',
        Country: 'RO',
        Email: 'test@example.com',
        NFP: true,
      },
      [{ O365GroupId: 'team-id', Tag: 'Member' }],
      true,
    );

    expect(apiPost).toHaveBeenCalledTimes(4);
    expect(apiPost).toHaveBeenCalledWith('https://graph.test/v1.0/teams/team-id/tags/', {
      displayName: 'Member',
      members: [{ userId: 'user-id' }],
    });
    expect(apiPost).toHaveBeenCalledWith('https://graph.test/v1.0/teams/main-group/tags/', {
      displayName: 'National-Focal-Points',
      members: [{ userId: 'user-id' }],
    });
    expect(logging.info).toHaveBeenCalledTimes(4);
  });

  test('does not post when existing tag already has user as member', async () => {
    const { tagHelper, logging, apiGet, apiPost, countryMappingHelper } = setupTagHelper();

    await tagHelper.initialize('UserMembership', { MainEionetGroupId: 'main-group' });
    countryMappingHelper.getCountryName.mockReturnValue('Romania');

    apiGet
      .mockResolvedValueOnce({
        success: true,
        data: { value: [{ id: 'existing-tag' }] },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { value: [{ id: 'member-1' }] },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { value: [{ id: 'existing-country-tag' }] },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { value: [{ id: 'member-2' }] },
      });

    await tagHelper.applyTags(
      {
        ADUserId: 'user-id',
        Country: 'RO',
        Email: 'test@example.com',
      },
      [{ O365GroupId: 'team-id', Tag: 'Member' }],
      false,
    );

    expect(apiPost).not.toHaveBeenCalled();
    expect(logging.info).not.toHaveBeenCalled();
  });

  test('adds user to existing tag member list and logs error response', async () => {
    const { tagHelper, logging, apiGet, apiPost, countryMappingHelper } = setupTagHelper();

    await tagHelper.initialize('UserMembership', { MainEionetGroupId: 'main-group' });
    countryMappingHelper.getCountryName.mockReturnValue('Romania');

    apiGet
      .mockResolvedValueOnce({
        success: true,
        data: { value: [{ id: 'existing-tag' }] },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { value: [] },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { value: [{ id: 'country-tag' }] },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { value: [] },
      });

    apiPost.mockResolvedValue({ success: false });

    await tagHelper.applyTags(
      {
        ADUserId: 'user-id',
        Country: 'RO',
        Email: 'test@example.com',
      },
      [{ O365GroupId: 'team-id', Tag: 'Member' }],
      false,
    );

    expect(apiPost).toHaveBeenCalledWith(
      'https://graph.test/v1.0/teams/team-id/tags/existing-tag/members',
      { userId: 'user-id' },
    );
    expect(apiPost).toHaveBeenCalledWith(
      'https://graph.test/v1.0/teams/team-id/tags/country-tag/members',
      { userId: 'user-id' },
    );
    expect(logging.info).toHaveBeenCalledWith(
      { MainEionetGroupId: 'main-group' },
      'Applying the tag Member for user with email test@example.com returned an error. Please check the tag.',
      '',
      {},
      'UserMembership',
    );
  });
});
