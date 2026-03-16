function setupFunction() {
  jest.resetModules();

  let registered;
  jest.doMock('@azure/functions', () => ({
    app: {
      http: jest.fn((name, definition) => {
        registered = { name, definition };
      }),
    },
  }));

  jest.doMock('../lib/configuration', () => ({
    getConfiguration: jest.fn(),
  }));

  jest.doMock('../processors/userRemovalProcessor', () => ({
    processUserRemoval: jest.fn(),
  }));

  require('../UserRemoval');

  const { getConfiguration } = require('../lib/configuration');
  const { processUserRemoval } = require('../processors/userRemovalProcessor');

  return {
    httpName: registered.name,
    handler: registered.definition.handler,
    getConfiguration,
    processUserRemoval,
  };
}

describe('UserRemoval function', () => {
  test('returns escaped and sorted html when applyRemove=false', async () => {
    const { httpName, handler, getConfiguration, processUserRemoval } = setupFunction();
    const context = { log: jest.fn(), error: jest.fn() };
    const request = { query: { get: jest.fn().mockReturnValue('false') } };

    getConfiguration.mockResolvedValue({
      RemoveNonSignedInUserNoOfDays: 10,
      UserRemovalLastSignInDateTime: '2024-01-01T00:00:00.000Z',
    });

    processUserRemoval.mockResolvedValue([
      {
        createdDateTime: '2020-01-01T00:00:00.000Z',
        lastSignInDateTime: '2021-01-01T00:00:00.000Z',
        lastSuccessfulSignInDateTime: '2021-02-01T00:00:00.000Z',
        organisationName: 'Org B',
        fields: {
          Title: 'Zulu',
          Email: 'z@example.com',
          Country: 'RO',
          Membership: ['b'],
          OtherMemberships: [],
          SignedIn: 1,
        },
      },
      {
        createdDateTime: '2020-01-01T00:00:00.000Z',
        lastSignInDateTime: '2021-01-01T00:00:00.000Z',
        lastSuccessfulSignInDateTime: '2021-02-02T00:00:00.000Z',
        organisationName: 'Org <A>',
        fields: {
          Title: '<Alpha>',
          Email: `a'o@example.com`,
          Country: 'AT',
          Membership: ['a&b'],
          OtherMemberships: [],
          SignedIn: 0,
        },
      },
    ]);

    const response = await handler(request, context);

    expect(httpName).toBe('UserRemoval');
    expect(response.status).toBe(200);
    expect(response.headers).toEqual({ 'Content-Type': 'text/html; charset=utf-8' });
    expect(response.body).toContain('&lt;Alpha&gt;');
    expect(response.body).toContain('a&#39;o@example.com');
    expect(response.body).toContain('Org &lt;A&gt;');
    expect(response.body).toContain('Last successful sign-in');
    expect(response.body).toContain('2021-02-02T00:00:00.000Z');

    const alphaIndex = response.body.indexOf('&lt;Alpha&gt;');
    const zuluIndex = response.body.indexOf('Zulu');
    expect(alphaIndex).toBeGreaterThan(-1);
    expect(zuluIndex).toBeGreaterThan(-1);
    expect(alphaIndex).toBeLessThan(zuluIndex);
  });

  test('returns applyRemove message when applyRemove=true', async () => {
    const { handler, getConfiguration, processUserRemoval } = setupFunction();
    const context = { log: jest.fn(), error: jest.fn() };
    const request = { query: { get: jest.fn().mockReturnValue('true') } };

    getConfiguration.mockResolvedValue({ UserListId: 'list-id' });
    processUserRemoval.mockResolvedValue(undefined);

    const response = await handler(request, context);

    expect(processUserRemoval).toHaveBeenCalledWith(context, { UserListId: 'list-id' }, true);
    expect(response.status).toBe(200);
    expect(response.body).toContain('The removed users were logged in the Logging list');
  });

  test('returns default message when processor returns no rows', async () => {
    const { handler, getConfiguration, processUserRemoval } = setupFunction();
    const context = { log: jest.fn(), error: jest.fn() };
    const request = { query: { get: jest.fn().mockReturnValue('false') } };

    getConfiguration.mockResolvedValue({ UserListId: 'list-id' });
    processUserRemoval.mockResolvedValue(undefined);

    const response = await handler(request, context);

    expect(response.status).toBe(200);
    expect(response.body).toContain('No users available for removal');
  });
});
