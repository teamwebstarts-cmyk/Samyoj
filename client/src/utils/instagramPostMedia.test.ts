import { beforeEach, describe, expect, it, vi } from 'vitest';
import { absoluteMediaUrlForApi, absolutizePostMediaBody } from './instagramPostMedia';

describe('instagramPostMedia', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'https://app.example.com' } });
  });

  it('absolutizes path-only media URLs', () => {
    expect(absoluteMediaUrlForApi('/api/media/public/org/a.png?sig=1')).toBe(
      'https://app.example.com/api/media/public/org/a.png?sig=1',
    );
    expect(absoluteMediaUrlForApi('https://cdn.example/a.jpg')).toBe('https://cdn.example/a.jpg');
  });

  it('absolutizes post body fields', () => {
    const body = absolutizePostMediaBody({
      caption: 'hi',
      imageUrl: '/api/media/public/x.png',
      mediaItems: [{ url: '/api/media/public/y.png', kind: 'image' }],
    });
    expect(body.imageUrl).toContain('https://app.example.com/api/media/public/x.png');
    expect(body.mediaItems?.[0].url).toContain('/api/media/public/y.png');
  });
});
