const { app } = require('@azure/functions');
const { getConfiguration } = require('./lib/configuration'),
  { processUserRemoval } = require('./processors/userRemovalProcessor'),
  { escapeHtml } = require('./lib/helpers/utils');

app.http('UserRemoval', {
  methods: ['GET'],
  route: 'removeUsers',
  handler: async (request, context) => {
    context.log('Running User Removal for all records...');
    const applyRemove = request.query.get('applyRemove') == 'true';
    try {
      const config = await getConfiguration();
      if (config) {
        const result = await processUserRemoval(context, config, applyRemove);

        if (result && !applyRemove) {
          const stringResult = result
            .sort(
              (a, b) =>
                a.fields.Country.localeCompare(b.fields.Country) ||
                a.fields.Title.localeCompare(b.fields.Title),
            )
            .map((u) => {
              const fields = u.fields;
              return `<tr>
              <td>${escapeHtml(fields.Title)}</td>
              <td>${escapeHtml(fields.Email)}</td>
              <td>${escapeHtml(fields.Country)}</td>
              <td>${escapeHtml(u.organisationName)}</td>
              <td>${escapeHtml(fields.Membership?.join(', '))}</td>
              <td>${escapeHtml(fields.OtherMemberships?.join(', '))}</td>
              <td>${escapeHtml(fields.SignedIn)}</td>
              <td>${escapeHtml(u.createdDateTime)}</td>
              <td>${escapeHtml(u.lastSignInDateTime)}</td>
            </tr>`;
            })
            .join('');

          const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Users to remove</title>
            </head>
            <body>
                <p>The following users can be deleted because they haven't completed the sign-in in the last ${config.RemoveNonSignedInUserNoOfDays} days or they have not had any activity since ${config.UserRemovalLastSignInDateTime}. </p>
                <table>
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Country</th><th>Organisation</th><th>Eionet groups</th><th>Other memberships</th><th>Signed-in</th><th>Created</th><th>Last sign-in</th></tr>
                  </thead>
                  <tbody>
                    ${stringResult || `<tr><td colspan="2"><em>No rows</em></td></tr>`}
                  </tbody>
                </table>
                </body>
            </html>
        `;
          return {
            body: html,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
            },
            status: 200,
          };
        } else if (applyRemove) {
          return {
            body: `Function UserRemoval executed successfully. The removed users were logged in the Logging list`,
            status: 200,
          };
        }
      }
    } catch (err) {
      context.error('Error in UserRemoval:', err.message);
    }

    return {
      body: `Function UserRemoval executed successfully. No users available for removal`,
      status: 200,
    };
  },
});
