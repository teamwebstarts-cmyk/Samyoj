import { describe, expect, it } from 'vitest';
import { getVisibleNavSections, getVisibleMobileMoreItems } from './navigation';

describe('Meta navigation', () => {
  it('exposes Facebook and Instagram inbox surfaces', () => {
    const paths = getVisibleNavSections('OWNER').flatMap((section) =>
      section.items.map((item) => item.to)
    );
    expect(paths).toContain('/facebook/inbox');
    expect(paths).toContain('/facebook/ads');
    expect(paths).toContain('/instagram/inbox');
    expect(paths).toContain('/instagram/comments');
  });

  it('keeps Meta inboxes available in mobile more navigation', () => {
    const paths = getVisibleMobileMoreItems('AGENT').map((item) => item.to);
    expect(paths).toContain('/facebook/inbox');
    expect(paths).toContain('/instagram/inbox');
  });
});
