import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import { MetaWhatsAppService } from './meta.service';

const originalMeta = {
  appId: config.meta.appId,
  appSecret: config.meta.appSecret,
  verifyToken: config.meta.verifyToken,
  allowTunnelWebhook: config.meta.allowTunnelWebhook,
  nodeEnv: config.nodeEnv,
};

describe('registerAppWebhook', () => {
  beforeEach(() => {
    config.meta.appId = '111111111111';
    config.meta.appSecret = 'app-secret';
    config.meta.verifyToken = 'verify-token';
    config.meta.allowTunnelWebhook = false;
    config.nodeEnv = 'development';
  });

  afterEach(() => {
    config.meta.appId = originalMeta.appId;
    config.meta.appSecret = originalMeta.appSecret;
    config.meta.verifyToken = originalMeta.verifyToken;
    config.meta.allowTunnelWebhook = originalMeta.allowTunnelWebhook;
    config.nodeEnv = originalMeta.nodeEnv;
    vi.unstubAllGlobals();
  });

  it('refuses to overwrite a live production callback with ngrok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            object: 'whatsapp_business_account',
            active: true,
            callback_url: 'https://app.samyoj.com/api/whatsapp/webhook',
            fields: [{ name: 'messages' }, { name: 'calls' }],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      MetaWhatsAppService.registerAppWebhook(
        'https://collision-modified-spur.ngrok-free.dev/api/whatsapp/webhook'
      )
    ).rejects.toThrow(/live production webhook/i);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const postCalls = fetchMock.mock.calls.filter((call) => {
      const init = call[1] as { method?: string } | undefined;
      return init?.method === 'POST';
    });
    expect(postCalls).toHaveLength(0);
  });

  it('still refuses to overwrite production with ngrok when opted in', async () => {
    config.nodeEnv = 'production';
    config.meta.allowTunnelWebhook = true;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            object: 'whatsapp_business_account',
            active: true,
            callback_url: 'https://app.samyoj.com/api/whatsapp/webhook',
            fields: [{ name: 'messages' }],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      MetaWhatsAppService.registerAppWebhook(
        'https://collision-modified-spur.ngrok-free.dev/api/whatsapp/webhook'
      )
    ).rejects.toThrow(/Production META_WEBHOOK_URL cannot be ngrok or localhost/i);

    const postCalls = fetchMock.mock.calls.filter((call) => {
      const init = call[1] as { method?: string } | undefined;
      return init?.method === 'POST';
    });
    expect(postCalls).toHaveLength(0);
  });

  it('allows overwriting a live production callback with ngrok in development when opted in', async () => {
    config.nodeEnv = 'development';
    config.meta.allowTunnelWebhook = true;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              object: 'whatsapp_business_account',
              active: true,
              callback_url: 'https://app.samyoj.com/api/whatsapp/webhook',
              fields: [{ name: 'messages' }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await MetaWhatsAppService.registerAppWebhook(
      'https://collision-modified-spur.ngrok-free.dev/api/whatsapp/webhook'
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init] = fetchMock.mock.calls[1] as [string, { method?: string; body?: string }];
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain(
      encodeURIComponent('https://collision-modified-spur.ngrok-free.dev/api/whatsapp/webhook')
    );
  });

  it('registers the production callback when replacing ngrok', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              object: 'whatsapp_business_account',
              active: true,
              callback_url: 'https://old.ngrok-free.dev/api/whatsapp/webhook',
              fields: [{ name: 'messages' }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await MetaWhatsAppService.registerAppWebhook('https://app.samyoj.com/api/whatsapp/webhook');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init] = fetchMock.mock.calls[1] as [string, { method?: string; body?: string }];
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain(encodeURIComponent('https://app.samyoj.com/api/whatsapp/webhook'));
    expect(String(init.body)).toContain('messages');
    expect(String(init.body)).toContain('calls');
  });
});
