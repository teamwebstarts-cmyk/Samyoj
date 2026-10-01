import { describe, expect, it } from 'vitest';
import { directSlideImageUrls } from './aiStudioPoster';

describe('directSlideImageUrls', () => {
  it('returns generated photo urls and skips template slides', () => {
    expect(directSlideImageUrls([{ image: '/api/media/public/a.png?exp=1&sig=x' }])).toEqual([
      '/api/media/public/a.png?exp=1&sig=x',
    ]);
    expect(directSlideImageUrls([{ image: null }, { image: '/api/media/public/b.png' }])).toBeNull();
  });
});
