import { describe, expect, it } from 'vitest';
import { instagramMediaThumbnailUrl } from './page-client';

describe('instagramMediaThumbnailUrl', () => {
  it('uses thumbnail_url for reels and video', () => {
    expect(
      instagramMediaThumbnailUrl({
        id: '1',
        media_type: 'REELS',
        thumbnail_url: 'https://cdn/thumb.jpg',
        media_url: 'https://cdn/video.mp4',
      })
    ).toBe('https://cdn/thumb.jpg');
  });

  it('uses media_url for photos', () => {
    expect(
      instagramMediaThumbnailUrl({
        id: '2',
        media_type: 'IMAGE',
        media_url: 'https://cdn/photo.jpg',
        thumbnail_url: 'https://cdn/thumb.jpg',
      })
    ).toBe('https://cdn/photo.jpg');
  });
});
