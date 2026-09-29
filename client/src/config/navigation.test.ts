import { describe, expect, it } from 'vitest';
import { getVisibleNavSections, getVisibleMobileMoreItems, getMobileBottomNav } from './navigation';

describe('Meta navigation', () => {
  it('exposes Facebook and Instagram inbox surfaces', () => {
    const paths = getVisibleNavSections('OWNER').flatMap((section) => [
      ...section.items.map((item) => item.to),
      ...(section.platforms?.flatMap((platform) => platform.items.map((item) => item.to)) ?? []),
    ]);
    expect(paths).toContain('/facebook/inbox');
    expect(paths).toContain('/facebook/ads');
    expect(paths).toContain('/instagram/inbox');
    expect(paths).toContain('/instagram/comments');
    expect(paths).toContain('/instagram/posts');
    expect(paths).not.toContain('/analytics');
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
    const channels = sections.find((s) => s.label === 'Channels');
    const facebook = channels?.platforms?.find((s) => s.accent === 'facebook');
    const messenger = facebook?.items.find((item) => item.to === '/facebook/inbox');
    expect(messenger?.label).toBe('Messenger');

    const aiStudio = sections.find((s) => s.label === 'AI Studio');
    expect(aiStudio?.items.map((i) => i.to)).toEqual(
      expect.arrayContaining(['/ai-bot', '/automations', '/content-studio'])
    );

    const contacts = sections.find((s) => s.label === 'Contacts');
    expect(contacts?.items.some((i) => i.to === '/contacts')).toBe(true);
    expect(contacts?.items.some((i) => i.to === '/campaigns')).toBe(true);
    const whatsapp = channels?.platforms?.find((s) => s.accent === 'whatsapp');
    expect(whatsapp?.items.some((i) => i.to === '/campaigns')).toBe(false);
  });

  it('keeps WhatsApp tabs when a number is connected, Meta tabs when it is not', () => {
    expect(getMobileBottomNav({ whatsapp: true, facebook: true, instagram: true, email: false }).map((i) => i.to)).toEqual([
      '/inbox',
      '/campaigns',
      '/contacts',
      '/automations',
    ]);
    expect(getMobileBottomNav({ whatsapp: false, facebook: true, instagram: true, email: false }).map((i) => i.to)).toEqual([
      '/',
      '/facebook/inbox',
      '/instagram/inbox',
      '/automations',
    ]);
    expect(getMobileBottomNav({ whatsapp: false, facebook: false, instagram: true, email: false }).map((i) => i.to)).toEqual([
      '/',
      '/instagram/inbox',
      '/instagram/comments',
      '/automations',
    ]);
  });
});
