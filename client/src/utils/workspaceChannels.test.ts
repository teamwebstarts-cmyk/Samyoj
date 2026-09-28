import { describe, expect, it } from 'vitest';
import {
  anyWorkspaceChannel,
  dashboardDescription,
  dashboardMoreActionKeys,
  dashboardQuickActionKeys,
  isWhatsAppSurface,
  topbarConnectionBadge,
  topbarLiveTitle,
  topbarNotConnectedTitle,
} from './workspaceChannels';

const ready = { numbersReady: true, metaReady: true };

describe('workspaceChannels', () => {
  it('treats any of the three channels as a live workspace', () => {
    expect(anyWorkspaceChannel({ whatsapp: false, facebook: true, instagram: true })).toBe(true);
    expect(anyWorkspaceChannel({ whatsapp: true, facebook: false, instagram: false })).toBe(true);
    expect(anyWorkspaceChannel({ whatsapp: false, facebook: false, instagram: true })).toBe(true);
    expect(anyWorkspaceChannel({ whatsapp: false, facebook: false, instagram: false })).toBe(false);
  });

  it('writes dashboard headings from the connected mix, not WhatsApp alone', () => {
    expect(dashboardDescription({ whatsapp: false, facebook: false, instagram: false })).toBe(
      'Connect a channel to get started'
    );
    expect(dashboardDescription({ whatsapp: true, facebook: false, instagram: false })).toBe(
      "Here's your WhatsApp workspace at a glance"
    );
    expect(dashboardDescription({ whatsapp: false, facebook: true, instagram: false })).toBe(
      'Facebook Page workspace at a glance'
    );
    expect(dashboardDescription({ whatsapp: false, facebook: false, instagram: true })).toBe(
      'Instagram workspace at a glance'
    );
    expect(dashboardDescription({ whatsapp: false, facebook: true, instagram: true })).toBe(
      'Facebook and Instagram at a glance'
    );
    expect(dashboardDescription({ whatsapp: true, facebook: true, instagram: false })).toBe(
      'WhatsApp and Facebook at a glance'
    );
    expect(dashboardDescription({ whatsapp: true, facebook: true, instagram: true })).toBe(
      'WhatsApp, Facebook, and Instagram at a glance'
    );
  });

  it('keeps WhatsApp-only pages on the number, Meta pages on their own channel', () => {
    expect(isWhatsAppSurface('/inbox')).toBe(true);
    expect(isWhatsAppSurface('/facebook/inbox')).toBe(false);

    const fbOnly = { whatsapp: false, facebook: true, instagram: true };
    expect(topbarConnectionBadge('/', fbOnly, ready)).toBe('live');
    expect(topbarConnectionBadge('/facebook/inbox', fbOnly, ready)).toBe('live');
    expect(topbarConnectionBadge('/inbox', fbOnly, ready)).toBe('not-connected');
    expect(topbarConnectionBadge('/campaigns', fbOnly, ready)).toBe('not-connected');
    expect(topbarConnectionBadge('/contacts', fbOnly, ready)).toBe('not-connected');
    expect(isWhatsAppSurface('/contacts')).toBe(true);
    expect(isWhatsAppSurface('/ai-bot')).toBe(false);

    const waOnly = { whatsapp: true, facebook: false, instagram: false };
    expect(topbarConnectionBadge('/', waOnly, ready)).toBe('live');
    expect(topbarConnectionBadge('/inbox', waOnly, ready)).toBe('live');
    expect(topbarConnectionBadge('/facebook/ads', waOnly, ready)).toBe('not-connected');
    expect(topbarConnectionBadge('/instagram/comments', waOnly, ready)).toBe('not-connected');

    const igOnly = { whatsapp: false, facebook: false, instagram: true };
    expect(topbarConnectionBadge('/', igOnly, ready)).toBe('live');
    expect(topbarConnectionBadge('/instagram/inbox', igOnly, ready)).toBe('live');
    expect(topbarConnectionBadge('/facebook/inbox', igOnly, ready)).toBe('not-connected');

    const none = { whatsapp: false, facebook: false, instagram: false };
    expect(topbarConnectionBadge('/', none, ready)).toBe('not-connected');
    expect(topbarLiveTitle('/facebook/inbox')).toMatch(/Facebook Page/);
    expect(topbarNotConnectedTitle('/')).toBe('No channel connected');
  });

  it('swaps dashboard quick actions off WhatsApp when only Meta channels are live', () => {
    expect(dashboardQuickActionKeys({ whatsapp: true, facebook: false, instagram: false })).toEqual([
      'inbox',
      'campaigns',
      'templates',
      'automations',
      'contacts',
    ]);
    expect(dashboardQuickActionKeys({ whatsapp: false, facebook: true, instagram: true })).toEqual([
      'messenger',
      'ads',
      'ig-inbox',
      'ig-comments',
      'automations',
    ]);
    expect(dashboardQuickActionKeys({ whatsapp: false, facebook: false, instagram: true })).toEqual([
      'ig-inbox',
      'ig-comments',
      'automations',
    ]);
    expect(dashboardMoreActionKeys({ whatsapp: true, facebook: true, instagram: false })).toEqual([
      'calls',
      'tickets',
      'usage',
      'messenger',
      'ads',
    ]);
  });
});
