import { describe, expect, it } from 'vitest';
import { shouldServeSpaShell } from './spa-shell';

describe('SPA shell methods', () => {
  it('serves GET and HEAD for app routes', () => {
    expect(shouldServeSpaShell('HEAD', '/login')).toBe(true);
    expect(shouldServeSpaShell('GET', '/login')).toBe(true);
  });

  it('leaves API, health, and other methods alone', () => {
    expect(shouldServeSpaShell('HEAD', '/api/templates')).toBe(false);
    expect(shouldServeSpaShell('POST', '/login')).toBe(false);
    expect(shouldServeSpaShell('GET', '/health')).toBe(false);
  });
});
