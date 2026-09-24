import { describe, expect, it } from 'vitest';
import { isInboxRoute } from './pageMeta';

describe('inbox shell routes', () => {
  it('locks scrolling for WhatsApp, Facebook, and Instagram inboxes', () => {
    expect(isInboxRoute('/inbox')).toBe(true);
    expect(isInboxRoute('/facebook/inbox')).toBe(true);
    expect(isInboxRoute('/instagram/inbox')).toBe(true);
  });

  it('does not classify unrelated pages as inbox shells', () => {
    expect(isInboxRoute('/facebook/ads')).toBe(false);
    expect(isInboxRoute('/instagram/comments')).toBe(false);
  });
});
