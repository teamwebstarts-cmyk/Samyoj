import { describe, expect, it } from 'vitest';
import { hasApprovedInstagramPostsRebuild } from './migration-reconciliation-constants';

describe('hasApprovedInstagramPostsRebuild', () => {
  it('allows the paired drop and restore sequence', () => {
    expect(
      hasApprovedInstagramPostsRebuild([
        '20260927183000_instagram_posts',
        '20260927190000_drop_instagram_posts',
        '20260928130500_instagram_posts_restore',
      ]),
    ).toBe(true);
  });

  it('rejects an unpaired destructive migration', () => {
    expect(hasApprovedInstagramPostsRebuild(['20260927190000_drop_instagram_posts'])).toBe(false);
    expect(hasApprovedInstagramPostsRebuild(['20260928130500_instagram_posts_restore'])).toBe(false);
  });
});
