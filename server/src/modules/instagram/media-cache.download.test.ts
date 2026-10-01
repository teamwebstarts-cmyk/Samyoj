import { describe, expect, it } from 'vitest';
import { thumbnailFetchUrl } from './media-cache.download';

describe('thumbnailFetchUrl', () => {
  it('does not stamp Graph tokens onto Instagram CDN URLs', () => {
    const cdn = 'https://scontent.cdninstagram.com/v/t51.2885-15/x.jpg?_nc_cat=1';
    expect(thumbnailFetchUrl(cdn, 'PAGE_TOKEN')).toBe(cdn);
  });

  it('adds an access token for Graph media endpoints', () => {
    const out = thumbnailFetchUrl('https://graph.facebook.com/v21.0/123/picture', 'PAGE_TOKEN');
    expect(out).toContain('access_token=PAGE_TOKEN');
  });
});
