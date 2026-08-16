import { afterEach, describe, expect, it, vi } from 'vitest';
import { platformRequest } from '../api';
import { CSRF_HEADER, setCsrfToken } from './session';

describe('platformRequest contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setCsrfToken(null);
  });

  it('posts login without CSRF and with credentials', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true, data: { state: 'MFA_REQUIRED' } }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    setCsrfToken('stale');
    await platformRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.c', password: 'x' }),
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/platform/auth/login');
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).get(CSRF_HEADER)).toBeNull();
  });

  it('sends CSRF on mutations other than login', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    setCsrfToken('csrf-value');
    await platformRequest('/orgs/1/ai', {
      method: 'PATCH',
      body: JSON.stringify({ reason: 'Adjust token cap' }),
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/platform/orgs/1/ai');
    expect(new Headers(init.headers).get(CSRF_HEADER)).toBe('csrf-value');
  });
});
