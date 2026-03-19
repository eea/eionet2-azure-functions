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
module.exports = {
  parseJoinMeetingId: parseJoinMeetingId,
  capitalize: capitalize,
  escapeHtml: escapeHtml,
};
