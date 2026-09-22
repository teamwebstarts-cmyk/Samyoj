import { describe, expect, it } from 'vitest';
import { isInjectedScriptNoise, sanitizeUserErrorMessage } from './errors';

describe('isInjectedScriptNoise', () => {
  it('filters Kaspersky M_ID TypeErrors', () => {
    const err = new TypeError("Cannot read properties of undefined (reading 'M_ID')");
    err.stack = 'TypeError: Cannot read properties of undefined (reading \'M_ID\')\n    at Z (200.js:1:761)';
    expect(isInjectedScriptNoise(err)).toBe(true);
    expect(isInjectedScriptNoise(err, { filename: '200.js' })).toBe(true);
  });

  it('filters injected 200.js / requests.js stacks', () => {
    expect(
      isInjectedScriptNoise('xhr failed', {
        stack: 'at XMLHttpRequest.send (requests.js:1:10)\n    at Z (200.js:1:2598)',
      })
    ).toBe(true);
    expect(isInjectedScriptNoise('ok', { filename: 'https://app.samyoj.com/assets/200.js?v=1' })).toBe(
      true
    );
  });

  it('does not filter real app errors', () => {
    const err = new TypeError("Cannot read properties of undefined (reading 'id')");
    err.stack =
      'TypeError: Cannot read properties of undefined (reading \'id\')\n    at unreadTotal (index-BUIMjAXK.js:59)';
    expect(isInjectedScriptNoise(err)).toBe(false);
    expect(isInjectedScriptNoise(err, { filename: 'index-BUIMjAXK.js' })).toBe(false);
    expect(isInjectedScriptNoise('API request failed')).toBe(false);
  });
});

describe('sanitizeUserErrorMessage', () => {
  it('hides Embedded Signup env runbooks from users', () => {
    expect(
      sanitizeUserErrorMessage(
        'WhatsApp connect is not configured. Set META_ES_CONFIG_ID in server/.env from Meta → Facebook Login for Business → Embedded Signup v4, then restart the API.',
      ),
    ).toBe(
      'WhatsApp connect isn’t ready yet. Try again in a few minutes. If it still doesn’t open, contact support.',
    );
    expect(sanitizeUserErrorMessage('Network request failed', 'META_ES_CONFIG_MISSING')).toMatch(
      /isn’t ready yet/,
    );
  });

  it('maps WhatsApp rate limits to a plain wait message', () => {
    const raw =
      '(#80008) There have been too many calls to this WhatsApp Business account. Wait a bit and try again. For more info, please refer to https://developers.facebook.com/docs/graph-api/overview/rate-limiting.';
    expect(sanitizeUserErrorMessage(raw)).toBe(
      'WhatsApp is busy right now. Wait a minute, then try again.',
    );
    expect(sanitizeUserErrorMessage(raw)).not.toMatch(/80008|developers\.facebook|localhost|webhook/i);
    expect(
      sanitizeUserErrorMessage('(#190) Error validating access token. fbtrace_id=ABC'),
    ).toBe('WhatsApp couldn’t complete that. Wait a minute, then try again.');
    expect(sanitizeUserErrorMessage('Add a coupon code.')).toBe('Add a coupon code.');
  });

  it('maps the production-webhook guard to a short user message', () => {
    expect(
      sanitizeUserErrorMessage(
        'Refusing to replace a live production webhook URL with an ngrok/localhost tunnel. That stops inbound.',
      ),
    ).toMatch(/Inbound stays on the live server/);
  });
});
