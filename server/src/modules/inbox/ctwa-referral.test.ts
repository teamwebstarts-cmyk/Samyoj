import { describe, expect, it, vi } from 'vitest';
import { parseInboundMessage } from './message-parser';
import { mergeCtwaReferral, whatsappAdFromBotState } from './ctwa-referral';

/** Official Cloud API text-message referral shape (Meta docs). */
const META_REFERRAL = {
  source_url: 'https://fb.me/3cr4Wqqkv',
  source_id: '120226305854810726',
  source_type: 'ad',
  body: 'Summer Succulents are here!',
  headline: 'Chat with us',
  media_type: 'image',
  image_url: 'https://scontent.xx.fbcdn.net/v/t45.1...',
  ctwa_clid: 'Aff-n8ZTODiE79d22KtAwQKj9e_mIEOOj27vDVwFjN80dp4',
};

const LEAD_CREATE = vi.fn();

function inboundTextFixture(withReferral: boolean) {
  return {
    from: '16505551234',
    id: 'wamid.ctwa.test',
    timestamp: '1750275992',
    type: 'text',
    text: { body: 'Can I get more info about this?' },
    ...(withReferral ? { referral: META_REFERRAL } : {}),
  };
}

describe('CTWA Phase 2 — inbound referral → chip data, no Lead', () => {
  it('inbound with referral saves chip data and does not create a Lead', () => {
    const parsed = parseInboundMessage(inboundTextFixture(true));
    expect(parsed.referral).toEqual(META_REFERRAL);

    const receivedAt = new Date('2026-09-23T12:00:00.000Z');
    const { next, wrote } = mergeCtwaReferral({}, parsed.referral!, receivedAt);
    expect(wrote).toBe(true);
    expect(next.ctwaReferral).toEqual(META_REFERRAL);
    expect(next.ctwaReceivedAt).toBe('2026-09-23T12:00:00.000Z');

    const chip = whatsappAdFromBotState(next);
    expect(chip).toEqual({
      sourceId: '120226305854810726',
      name: 'Chat with us',
      sourceType: 'ad',
      sourceUrl: 'https://fb.me/3cr4Wqqkv',
      body: 'Summer Succulents are here!',
      ctwaClid: 'Aff-n8ZTODiE79d22KtAwQKj9e_mIEOOj27vDVwFjN80dp4',
      receivedAt: '2026-09-23T12:00:00.000Z',
    });

    expect(LEAD_CREATE).not.toHaveBeenCalled();
  });

  it('inbound without referral yields no chip data', () => {
    const parsed = parseInboundMessage(inboundTextFixture(false));
    expect(parsed.referral).toBeUndefined();

    const chip = whatsappAdFromBotState({});
    expect(chip).toBeNull();
    expect(whatsappAdFromBotState({ flowId: 'x' })).toBeNull();
  });

  it('repeat webhook does not duplicate or overwrite referral', () => {
    const first = mergeCtwaReferral({}, META_REFERRAL, new Date('2026-09-23T12:00:00.000Z'));
    expect(first.wrote).toBe(true);

    const second = mergeCtwaReferral(first.next, {
      ...META_REFERRAL,
      headline: 'Different headline',
      source_id: '999',
    }, new Date('2026-09-23T13:00:00.000Z'));

    expect(second.wrote).toBe(false);
    expect(second.next.ctwaReferral).toEqual(META_REFERRAL);
    expect(second.next.ctwaReceivedAt).toBe('2026-09-23T12:00:00.000Z');
    expect(whatsappAdFromBotState(second.next)?.name).toBe('Chat with us');
  });

  it('falls back to body when headline is missing', () => {
    const { next } = mergeCtwaReferral({}, {
      source_type: 'ad',
      source_id: '1',
      body: 'Only body copy',
    });
    expect(whatsappAdFromBotState(next)?.name).toBe('Only body copy');
  });

  it('non-ad referral does not write or show the WhatsApp ad chip', () => {
    const { next, wrote } = mergeCtwaReferral({}, {
      source_type: 'post',
      source_id: 'post_1',
      headline: 'Organic post',
    });
    expect(wrote).toBe(false);
    expect(next.ctwaReferral).toBeUndefined();
    expect(whatsappAdFromBotState(next)).toBeNull();
    expect(
      whatsappAdFromBotState({
        ctwaReferral: { source_type: 'post', headline: 'stale' },
        ctwaReceivedAt: '2026-09-23T12:00:00.000Z',
      })
    ).toBeNull();
  });
});
