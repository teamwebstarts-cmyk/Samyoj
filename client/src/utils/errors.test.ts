import { describe, expect, it } from 'vitest';
import { isInjectedScriptNoise } from './errors';

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
