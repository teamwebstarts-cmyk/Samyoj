import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import { MetaWhatsAppService } from './meta.service';

const originalMeta = {
  appId: config.meta.appId,
  appSecret: config.meta.appSecret,
};

describe('Meta Graph GET auth', () => {
  beforeEach(() => {
    config.meta.appId = '111111111111';
    config.meta.appSecret = 'app-secret';
  });

  afterEach(() => {
    config.meta.appId = originalMeta.appId;
    config.meta.appSecret = originalMeta.appSecret;
    vi.unstubAllGlobals();
  });

  it('sends the user token as Bearer and never on the query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await MetaWhatsAppService.graphGetPublic('/123/phone_numbers?fields=id', 'user-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers?: { Authorization?: string } },
    ];
    expect(String(url)).not.toContain('user-token');
    expect(String(url)).not.toMatch(/access_token=/);
    expect(init.headers?.Authorization).toBe('Bearer user-token');
    expect(String(url)).toContain('/123/phone_numbers');
  });

  it('drops an access_token already present on paging.next query strings', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await MetaWhatsAppService.graphGetPublic(
      '/cat/products?limit=100&access_token=leaked-token&after=CURSOR',
      'bearer-token'
    );

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers?: { Authorization?: string } },
    ];
    expect(String(url)).not.toContain('leaked-token');
    expect(String(url)).not.toMatch(/access_token=/);
    expect(String(url)).toContain('after=CURSOR');
    expect(init.headers?.Authorization).toBe('Bearer bearer-token');
  });

  it('inspects debug_token with the app token in Authorization, not the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          granular_scopes: [
            { scope: 'whatsapp_business_management', target_ids: ['waba-1'] },
          ],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(MetaWhatsAppService.resolveWabaId('user-token')).resolves.toBe('waba-1');

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers?: { Authorization?: string } },
    ];
    expect(String(url)).toContain('/debug_token');
    expect(String(url)).toContain('input_token=user-token');
    expect(String(url)).not.toContain('app-secret');
    expect(String(url)).not.toMatch(/access_token=/);
    expect(init.headers?.Authorization).toBe('Bearer 111111111111|app-secret');
  });
});
