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

  it('uses Messenger-native labels for Facebook inbox navigation', () => {
    const mobile = getVisibleMobileMoreItems('OWNER').find((item) => item.to === '/facebook/inbox');
    expect(mobile?.label).toBe('Messenger Inbox');

    const sections = getVisibleNavSections('OWNER');
    const facebook = sections.find((s) => s.accent === 'facebook');
    const messenger = facebook?.items.find((item) => item.to === '/facebook/inbox');
    expect(messenger?.label).toBe('Messenger');
  });
});
