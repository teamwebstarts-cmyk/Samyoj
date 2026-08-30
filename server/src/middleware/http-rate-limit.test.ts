import { describe, expect, it } from 'vitest';
import { skipGlobalHttpRateLimit } from './http-rate-limit';

describe('skipGlobalHttpRateLimit', () => {
  it('skips SPA pages and static assets so the UI cannot 429', () => {
    expect(skipGlobalHttpRateLimit('/')).toBe(true);
    expect(skipGlobalHttpRateLimit('/login')).toBe(true);
    expect(skipGlobalHttpRateLimit('/login?returnTo=/inbox')).toBe(true);
    expect(skipGlobalHttpRateLimit('/favicon.ico')).toBe(true);
    expect(skipGlobalHttpRateLimit('/vite.svg')).toBe(true);
    expect(skipGlobalHttpRateLimit('/brand/samyoj logo.png')).toBe(true);
    expect(skipGlobalHttpRateLimit('/assets/index-B-903vXC.js')).toBe(true);
  });

  it('skips health, webhook, and socket upgrades', () => {
    expect(skipGlobalHttpRateLimit('/health')).toBe(true);
    expect(skipGlobalHttpRateLimit('/api/whatsapp/webhook')).toBe(true);
    expect(skipGlobalHttpRateLimit('/api/socket.io')).toBe(true);
    expect(skipGlobalHttpRateLimit('/api/inbox', 'websocket')).toBe(true);
  });

  it('still rate-limits product APIs', () => {
    expect(skipGlobalHttpRateLimit('/api/inbox')).toBe(false);
    expect(skipGlobalHttpRateLimit('/api/auth/login')).toBe(false);
    expect(skipGlobalHttpRateLimit('/api/auth/me')).toBe(false);
  });
});
