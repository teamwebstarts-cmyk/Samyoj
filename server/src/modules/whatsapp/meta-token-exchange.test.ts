import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

describe('MetaWhatsAppService token exchange', () => {
  it('POSTs client_secret in the body, not on the URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok-short' }),
    });

    const { MetaWhatsAppService } = await import('./meta.service');
    const token = await MetaWhatsAppService.exchangeCodeForToken(
      'auth-code',
      { appId: 'app-1', appSecret: 'secret-1' },
      'http://localhost:3000/settings/whatsapp/callback/popup'
    );

    expect(token).toBe('tok-short');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/oauth\/access_token$/);
    expect(url).not.toContain('client_secret');
    expect(init.method).toBe('POST');
    expect(String(init.headers && (init.headers as Record<string, string>)['Content-Type'])).toMatch(
      /application\/x-www-form-urlencoded/
    );
    const body = String(init.body);
    expect(body).toContain('client_secret=secret-1');
    expect(body).toContain('client_id=app-1');
    expect(body).toContain('code=auth-code');
    expect(body).toContain(
      encodeURIComponent('http://localhost:3000/settings/whatsapp/callback/popup')
    );
  });

  it('omits redirect_uri for an FB.login JS SDK code', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok-short' }),
    });

    const { MetaWhatsAppService } = await import('./meta.service');
    await MetaWhatsAppService.exchangeCodeForToken('auth-code', {
      appId: 'app-1',
      appSecret: 'secret-1',
    });

    const body = String(fetchMock.mock.calls[0][1].body);
    expect(body).not.toContain('redirect_uri');
  });

  it('POSTs long-lived exchange without putting the secret on the URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok-long' }),
    });

    const { MetaWhatsAppService } = await import('./meta.service');
    const token = await MetaWhatsAppService.exchangeForLongLivedToken('tok-short', {
      appId: 'app-1',
      appSecret: 'secret-1',
    });

    expect(token).toBe('tok-long');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/oauth\/access_token$/);
    expect(url).not.toContain('client_secret');
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('client_secret=secret-1');
    expect(String(init.body)).toContain('fb_exchange_token=tok-short');
  });
});
