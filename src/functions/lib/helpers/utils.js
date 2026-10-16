// Microsoft Graph only exposes onlineMeeting/attendance data for meetings that
// ended within the last 60 days. Past this window an empty/404 response is
// expected and not a sign of a misconfigured organiser.
const MEETING_RETENTION_DAYS = 60;

function parseJoinMeetingId(meetingId) {
  const parsedJoinId = meetingId?.match(/\d+/g);
  let joinMeetingId;

  parsedJoinId && (joinMeetingId = parsedJoinId.join(''));

  return joinMeetingId;
}

function capitalize(str) {
  const result = str?.toLowerCase().replaceAll('_', ' ');
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// Minimal HTML escaping to avoid breaking the table / XSS
function escapeHtml(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isMeetingBeyondRetention(meetingEnd, retentionDays = MEETING_RETENTION_DAYS) {
  if (!meetingEnd) return false;
  const endDate = new Date(meetingEnd);
  if (isNaN(endDate.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return endDate < cutoff;
}

// Graph answers an onlineMeetings lookup that matches nothing with 404
// ("3004: Specified meeting is not found") rather than an empty list. This also
// happens for valid meetings created in Outlook/Teams whose onlineMeeting record
// Graph no longer exposes, so it is not proof of a wrong organiser or code.
function isMeetingNotFound(response) {
  if (response?.success) {
    return !response.data?.value?.length;
  }
  return response?.error?.response?.status === 404;
}

const SENSITIVE_QUERY_PARAMS =
  /([?&](?:key|apikey|api_key|token|access_token|secret|password)=)[^&]*/gi;

function redactUrl(url) {
  return url?.replace(SENSITIVE_QUERY_PARAMS, '$1[REDACTED]');
}

// Axios errors carry the full request config (including the Authorization header and
// the request body) and the raw request, so serializing or printing them leaks the
// bearer token. Keep only the parts useful for troubleshooting.
function sanitizeError(error) {
  if (!error?.isAxiosError) {
    return error;
  }
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    status: error.response?.status,
    method: error.config?.method,
    url: redactUrl(error.config?.url),
    responseData: error.response?.data,
  };
}

module.exports = {
  parseJoinMeetingId: parseJoinMeetingId,
  capitalize: capitalize,
  escapeHtml: escapeHtml,
  isMeetingBeyondRetention: isMeetingBeyondRetention,
  MEETING_RETENTION_DAYS: MEETING_RETENTION_DAYS,
  isMeetingNotFound: isMeetingNotFound,
  sanitizeError: sanitizeError,
};
