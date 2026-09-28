import { describe, expect, it } from 'vitest';
import { CAROUSEL_MAX, CAROUSEL_MIN, parseMediaPayload, resolvePostMedia } from './posts.media';

describe('instagram post media', () => {
  it('parses payload rows', () => {
    expect(parseMediaPayload([{ url: 'https://a/img.jpg', kind: 'image' }])).toEqual([
      { url: 'https://a/img.jpg', kind: 'image' },
    ]);
  });

  it('requires video for reels', () => {
    expect(() => resolvePostMedia({ mediaType: 'REELS' })).toThrow(/video/i);
  });

  it('enforces carousel size', () => {
    const one = [{ url: 'https://a/1.jpg', kind: 'image' as const }];
    expect(() => resolvePostMedia({ mediaType: 'CAROUSEL', mediaItems: one })).toThrow(
      new RegExp(`${CAROUSEL_MIN}`)
    );
    const many = Array.from({ length: CAROUSEL_MAX + 1 }, (_, i) => ({
      url: `https://a/${i}.jpg`,
      kind: 'image' as const,
    }));
    expect(() => resolvePostMedia({ mediaType: 'CAROUSEL', mediaItems: many })).toThrow(
      new RegExp(`${CAROUSEL_MAX}`)
    );
  });

  it('resolves carousel cover from first slide', () => {
    const items = [
      { url: 'https://a/1.jpg', kind: 'image' as const },
      { url: 'https://a/2.mp4', kind: 'video' as const },
    ];
    const row = resolvePostMedia({ mediaType: 'CAROUSEL', mediaItems: items });
    expect(row.imageUrl).toBe('https://a/1.jpg');
    expect(row.mediaPayload).toHaveLength(2);
  });
});
