import { afterEach, describe, expect, it, vi } from 'vitest';
import { publishInstagramPost, waitForContainer } from './posts.publish';

describe('publishInstagramPost', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('publishes an image with FINISHED container', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/media_publish')) {
        return { ok: true, json: async () => ({ id: 'ig_99' }) };
      }
      if (u.includes('status_code')) {
        return { ok: true, json: async () => ({ status_code: 'FINISHED' }) };
      }
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 'ctr_1' }) };
      }
      return { ok: false, json: async () => ({ error: { message: 'unexpected' } }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await publishInstagramPost({
      igUserId: 'ig_user',
      accessToken: 'token',
      mediaType: 'IMAGE',
      caption: 'hi',
      imageUrl: 'https://cdn.example/a.jpg',
      mediaPayload: null,
    });
    expect(result.igMediaId).toBe('ig_99');
    expect(result.containerId).toBe('ctr_1');
  });

  it('fails closed when Graph never finishes a container', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ status_code: 'IN_PROGRESS' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      waitForContainer('ctr_slow', 'token', { maxAttempts: 1 }),
    ).rejects.toThrow('still processing');
  });
});
