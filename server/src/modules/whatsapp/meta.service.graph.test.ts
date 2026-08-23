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

describe('getConversationAnalytics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses nested field expansion, not conversation_analytics.data(querystring)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        conversation_analytics: {
          data: [{ data_points: [{ conversation_category: 'SERVICE', conversation: 2, cost: 0 }] }],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const points = await MetaWhatsAppService.getConversationAnalytics(
      'waba-1',
      'user-token',
      1787356800,
      1787443200
    );

    expect(points).toEqual([{ conversation_category: 'SERVICE', conversation: 2, cost: 0 }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(url).toContain('conversation_analytics.start(1787356800).end(1787443200).granularity(DAILY)');
    expect(url).toContain('dimensions(["CONVERSATION_CATEGORY"])');
    expect(url).not.toContain('conversation_analytics.data(');
    expect(url).not.toMatch(/start=\d/);
  });
});
