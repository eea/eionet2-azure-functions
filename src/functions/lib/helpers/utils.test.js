// Comprehensive tests for utils.js
const utils = require('./utils');

describe('utils', () => {
  describe('parseJoinMeetingId', () => {
    test('should extract numbers from meeting ID', () => {
      const result = utils.parseJoinMeetingId('256 856 969');
      expect(result).toBe('256856969');
    });

    test('should handle meeting ID with spaces', () => {
      const result = utils.parseJoinMeetingId('123 456 789');
      expect(result).toBe('123456789');
    });

    test('should handle meeting ID without spaces', () => {
      const result = utils.parseJoinMeetingId('123456789');
      expect(result).toBe('123456789');
    });

    test('should handle meeting ID with mixed characters', () => {
      const result = utils.parseJoinMeetingId('abc123def456ghi');
      expect(result).toBe('123456');
    });

    test('should handle meeting ID with only letters', () => {
      const result = utils.parseJoinMeetingId('abcdef');
      expect(result).toBeUndefined();
    });

    test('should handle empty string', () => {
      const result = utils.parseJoinMeetingId('');
      expect(result).toBeUndefined();
    });

    test('should handle null input', () => {
      const result = utils.parseJoinMeetingId(null);
      expect(result).toBeUndefined();
    });

    test('should handle undefined input', () => {
      const result = utils.parseJoinMeetingId(undefined);
      expect(result).toBeUndefined();
    });

    test('should handle meeting ID with special characters', () => {
      const result = utils.parseJoinMeetingId('123-456-789');
      expect(result).toBe('123456789');
    });

    test('should handle meeting ID with multiple spaces', () => {
      const result = utils.parseJoinMeetingId('123   456   789');
      expect(result).toBe('123456789');
    });
  });

  describe('capitalize', () => {
    test('should capitalize first letter and replace underscores with spaces', () => {
      const result = utils.capitalize('hello_world');
      expect(result).toBe('Hello world');
    });

    test('should handle single word', () => {
      const result = utils.capitalize('hello');
      expect(result).toBe('Hello');
    });

    test('should handle multiple underscores', () => {
      const result = utils.capitalize('hello_world_test');
      expect(result).toBe('Hello world test');
    });

    test('should handle already capitalized string', () => {
      const result = utils.capitalize('HELLO_WORLD');
      expect(result).toBe('Hello world');
    });

    test('should handle mixed case', () => {
      const result = utils.capitalize('HeLLo_WoRLd');
      expect(result).toBe('Hello world');
    });

    test('should handle empty string', () => {
      const result = utils.capitalize('');
      expect(result).toBe('');
    });

    test('should handle null input', () => {
      expect(() => utils.capitalize(null)).toThrow();
    });

    test('should handle undefined input', () => {
      expect(() => utils.capitalize(undefined)).toThrow();
    });

    test('should handle string without underscores', () => {
      const result = utils.capitalize('hello');
      expect(result).toBe('Hello');
    });

    test('should handle string with only underscores', () => {
      const result = utils.capitalize('___');
      expect(result).toBe('   ');
    });
  });

  describe('escapeHtml', () => {
    test('escapes special html characters', () => {
      const result = utils.escapeHtml(`Tom & "Jerry" <script>alert('x')</script>`);
      expect(result).toBe(
        'Tom &amp; &quot;Jerry&quot; &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;',
      );
    });

    test('handles null and undefined inputs', () => {
      expect(utils.escapeHtml(null)).toBe('null');
      expect(utils.escapeHtml(undefined)).toBe('');
    });
  });

  describe('isMeetingBeyondRetention', () => {
    const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

    test('returns true when the meeting ended before the 60-day cutoff', () => {
      expect(utils.isMeetingBeyondRetention(daysAgo(90))).toBe(true);
    });

    test('returns false when the meeting ended within the 60-day window', () => {
      expect(utils.isMeetingBeyondRetention(daysAgo(10))).toBe(false);
    });

    test('returns false for missing or invalid input', () => {
      expect(utils.isMeetingBeyondRetention(undefined)).toBe(false);
      expect(utils.isMeetingBeyondRetention(null)).toBe(false);
      expect(utils.isMeetingBeyondRetention('')).toBe(false);
      expect(utils.isMeetingBeyondRetention('not-a-date')).toBe(false);
    });

    test('respects custom retention window', () => {
      expect(utils.isMeetingBeyondRetention(daysAgo(20), 10)).toBe(true);
      expect(utils.isMeetingBeyondRetention(daysAgo(5), 10)).toBe(false);
    });
  });

  describe('sanitizeError', () => {
    const buildAxiosError = (url) => ({
      isAxiosError: true,
      name: 'AxiosError',
      message: 'Request failed with status code 404',
      code: 'ERR_BAD_REQUEST',
      config: {
        method: 'get',
        url: url,
        headers: { Authorization: 'Bearer secret-token' },
        data: '{"mail":"user@test.com"}',
      },
      request: { _header: 'Authorization: Bearer secret-token' },
      response: { status: 404, data: { error: { message: 'Not found' } } },
    });

    test('should keep only troubleshooting fields of an axios error', () => {
      const result = utils.sanitizeError(buildAxiosError('https://graph.test/users/1'));
      expect(result).toEqual({
        name: 'AxiosError',
        message: 'Request failed with status code 404',
        code: 'ERR_BAD_REQUEST',
        status: 404,
        method: 'get',
        url: 'https://graph.test/users/1',
        responseData: { error: { message: 'Not found' } },
      });
      expect(JSON.stringify(result)).not.toContain('secret-token');
    });

    test('should redact sensitive query parameters in the url', () => {
      const result = utils.sanitizeError(
        buildAxiosError('https://rn3.test/dataflow/RO?asc=0&key=abc123&pageNum=1'),
      );
      expect(result.url).toBe('https://rn3.test/dataflow/RO?asc=0&key=[REDACTED]&pageNum=1');
    });

    test('should return non-axios errors unchanged', () => {
      const error = new Error('boom');
      expect(utils.sanitizeError(error)).toBe(error);
      expect(utils.sanitizeError(undefined)).toBeUndefined();
    });
  });
});
