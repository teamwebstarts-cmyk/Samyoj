import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetaWhatsAppService } from './meta.service';

describe('Meta sendMessage retry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not retry after abort/timeout', async () => {
    const fetchMock = vi.fn().mockRejectedValue(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      MetaWhatsAppService.sendMessage(
        'pn',
        'token',
        { to: '9198', type: 'text', text: { body: 'hi' } },
        { maxAttempts: 4 }
      )
    ).rejects.toMatchObject({ message: /timed out after the request started/ });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as { signal?: AbortSignal };
    expect(init.signal).toBeDefined();
  });

  it('retries a 429 rate limit then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: 'rate', code: 130429 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.1' }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await MetaWhatsAppService.sendMessage(
      'pn',
      'token',
      { to: '9198', type: 'text', text: { body: 'hi' } },
      { maxAttempts: 4 }
    );

    expect(result.messages[0].id).toBe('wamid.1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
