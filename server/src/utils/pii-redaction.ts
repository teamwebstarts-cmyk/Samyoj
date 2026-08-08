const PHONE_PATTERN = /\+?\d{10,15}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const TOKEN_PATTERN = /(Bearer\s+|wa_)[a-zA-Z0-9._-]+/gi;
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'accessToken',
  'access_token',
  'encryptedToken',
  'secret',
  'key',
  'apiKey',
  'authorization',
  'x-api-key',
  'content',
  'body',
  'message',
]);

function redactString(value: string): string {
  return value
    .replace(TOKEN_PATTERN, '[REDACTED_TOKEN]')
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(PHONE_PATTERN, '[REDACTED_PHONE]');
}

/** Strip phone numbers, emails, and auth tokens from a free-text string (keeps the rest). */
export function redactText(value: string): string {
  return redactString(value);
}

export function redactPii<T>(input: T, depth = 0): T {
  if (depth > 8) return '[MAX_DEPTH]' as T;
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') return redactString(input) as T;
  if (typeof input !== 'object') return input;

  if (Array.isArray(input)) {
    return input.map((item) => redactPii(item, depth + 1)) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      result[key] = redactString(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactPii(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
