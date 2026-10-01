import { describe, expect, it } from 'vitest';
import { getPageMeta, isEmailShellRoute, isInboxRoute } from './pageMeta';

describe('inbox shell routes', () => {
  it('locks scrolling for WhatsApp, Facebook, and Instagram inboxes', () => {
    expect(isInboxRoute('/inbox')).toBe(true);
    expect(isInboxRoute('/facebook/inbox')).toBe(true);
    expect(isInboxRoute('/instagram/inbox')).toBe(true);
  });

  it('locks the app shell on email compose and templates', () => {
    expect(isEmailShellRoute('/email/compose')).toBe(true);
    expect(isEmailShellRoute('/email/templates')).toBe(true);
    expect(isEmailShellRoute('/email')).toBe(false);
    expect(isEmailShellRoute('/inbox')).toBe(false);
  });

  it('does not classify unrelated pages as inbox shells', () => {
    expect(isInboxRoute('/facebook/ads')).toBe(false);
    expect(isInboxRoute('/instagram/comments')).toBe(false);
  });

  it('uses Messenger-native title for Facebook inbox', () => {
    expect(getPageMeta('/facebook/inbox').title).toBe('Messenger Inbox');
    expect(getPageMeta('/facebook/inbox').description).toContain('24-hour');
  });

  it('does not lock Dashboard, Settings, or AI Bots copy to WhatsApp only', () => {
    expect(getPageMeta('/').description).toBe('Your workspace at a glance');
    expect(getPageMeta('/settings').description).toBe('Connect channels and set up your workspace');
    expect(getPageMeta('/ai-bot').description).not.toMatch(/WhatsApp/);
    expect(getPageMeta('/onboarding').description).toBe('Set up your workspace');
  });
});
