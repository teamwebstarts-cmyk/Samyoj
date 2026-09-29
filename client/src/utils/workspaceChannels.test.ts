import { describe, expect, it } from 'vitest';
import {
  anyWorkspaceChannel,
  dashboardDescription,
  dashboardMoreActionKeys,
  dashboardQuickActionKeys,
  isEmailSurface,
  isWhatsAppSurface,
  topbarConnectionBadge,
  topbarLiveTitle,
  topbarNotConnectedTitle,
} from './workspaceChannels';

const ready = { numbersReady: true, metaReady: true };

describe('workspaceChannels', () => {
  it('treats any of the four channels as a live workspace', () => {
    expect(anyWorkspaceChannel({ whatsapp: false, facebook: true, instagram: true, email: false })).toBe(true);
    expect(anyWorkspaceChannel({ whatsapp: true, facebook: false, instagram: false, email: false })).toBe(true);
    expect(anyWorkspaceChannel({ whatsapp: false, facebook: false, instagram: true, email: false })).toBe(true);
    expect(anyWorkspaceChannel({ whatsapp: false, facebook: false, instagram: false, email: true })).toBe(true);
    expect(anyWorkspaceChannel({ whatsapp: false, facebook: false, instagram: false, email: false })).toBe(false);
  });

  it('writes dashboard headings from the connected mix, not WhatsApp alone', () => {
    expect(dashboardDescription({ whatsapp: false, facebook: false, instagram: false, email: false })).toBe(
      'Connect a channel to get started'
    );
    expect(dashboardDescription({ whatsapp: true, facebook: false, instagram: false, email: false })).toBe(
      "Here's your WhatsApp workspace at a glance"
    );
    expect(dashboardDescription({ whatsapp: false, facebook: true, instagram: false, email: false })).toBe(
      'Facebook Page workspace at a glance'
    );
    expect(dashboardDescription({ whatsapp: false, facebook: false, instagram: true, email: false })).toBe(
      'Instagram workspace at a glance'
    );
    expect(dashboardDescription({ whatsapp: false, facebook: false, instagram: false, email: true })).toBe(
      'Email workspace at a glance'
    );
    expect(dashboardDescription({ whatsapp: false, facebook: true, instagram: true, email: false })).toBe(
      'Facebook and Instagram at a glance'
    );
    expect(dashboardDescription({ whatsapp: true, facebook: true, instagram: false, email: false })).toBe(
      'WhatsApp and Facebook at a glance'
    );
    expect(dashboardDescription({ whatsapp: true, facebook: true, instagram: true, email: true })).toBe(
      'WhatsApp, Facebook, Instagram, and Email at a glance'
    );
  });

  it('keeps WhatsApp-only pages on the number, Meta pages on their own channel', () => {
    expect(isWhatsAppSurface('/inbox')).toBe(true);
    expect(isWhatsAppSurface('/facebook/inbox')).toBe(false);
    expect(isEmailSurface('/email')).toBe(true);
    expect(isEmailSurface('/email/compose')).toBe(true);
    expect(isEmailSurface('/inbox')).toBe(false);

    const fbOnly = { whatsapp: false, facebook: true, instagram: true, email: false };
    expect(topbarConnectionBadge('/', fbOnly, ready)).toBe('live');
    expect(topbarConnectionBadge('/facebook/inbox', fbOnly, ready)).toBe('live');
    expect(topbarConnectionBadge('/inbox', fbOnly, ready)).toBe('not-connected');
    expect(topbarConnectionBadge('/campaigns', fbOnly, ready)).toBe('not-connected');
    expect(topbarConnectionBadge('/contacts', fbOnly, ready)).toBe('not-connected');
    expect(isWhatsAppSurface('/contacts')).toBe(true);
    expect(isWhatsAppSurface('/ai-bot')).toBe(false);

    const waOnly = { whatsapp: true, facebook: false, instagram: false, email: false };
    expect(topbarConnectionBadge('/', waOnly, ready)).toBe('live');
    expect(topbarConnectionBadge('/inbox', waOnly, ready)).toBe('live');
    expect(topbarConnectionBadge('/facebook/ads', waOnly, ready)).toBe('not-connected');
    expect(topbarConnectionBadge('/instagram/comments', waOnly, ready)).toBe('not-connected');

    const igOnly = { whatsapp: false, facebook: false, instagram: true, email: false };
    expect(topbarConnectionBadge('/', igOnly, ready)).toBe('live');
    expect(topbarConnectionBadge('/instagram/inbox', igOnly, ready)).toBe('live');
    expect(topbarConnectionBadge('/facebook/inbox', igOnly, ready)).toBe('not-connected');

    const emailOnly = { whatsapp: false, facebook: false, instagram: false, email: true };
    expect(topbarConnectionBadge('/email', emailOnly, ready)).toBe('live');
    expect(topbarConnectionBadge('/email/compose', emailOnly, ready)).toBe('live');
    expect(topbarConnectionBadge('/inbox', emailOnly, ready)).toBe('not-connected');

    const none = { whatsapp: false, facebook: false, instagram: false, email: false };
    expect(topbarConnectionBadge('/', none, ready)).toBe('not-connected');
    expect(topbarLiveTitle('/facebook/inbox')).toMatch(/Facebook Page/);
    expect(topbarNotConnectedTitle('/')).toBe('No channel connected');
  });

  it('swaps dashboard quick actions off WhatsApp when only Meta channels are live', () => {
    expect(dashboardQuickActionKeys({ whatsapp: true, facebook: false, instagram: false, email: false })).toEqual([
      'inbox',
      'campaigns',
      'templates',
      'automations',
      'contacts',
    ]);
    expect(dashboardQuickActionKeys({ whatsapp: false, facebook: true, instagram: true, email: false })).toEqual([
      'messenger',
      'ads',
      'ig-inbox',
      'ig-comments',
      'automations',
    ]);
    expect(dashboardQuickActionKeys({ whatsapp: false, facebook: false, instagram: true, email: false })).toEqual([
      'ig-inbox',
      'ig-comments',
      'automations',
    ]);
    expect(dashboardMoreActionKeys({ whatsapp: true, facebook: true, instagram: false, email: false })).toEqual([
      'calls',
      'tickets',
      'usage',
      'messenger',
      'ads',
    ]);
  });
});
