import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../config/database';
import { processWebhookPayload } from '../../workers/webhook.processor';
import {
  channelMessageAttachment,
  dispatchPageWebhookFields,
  providerWebhookEventKey,
} from './webhook-dispatcher';

vi.mock('../../config/database', () => ({
  default: {
    channel: { findMany: vi.fn() },
    whatsappNumber: { findFirst: vi.fn() },
    conversation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    contact: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    message: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    organization: { findUnique: vi.fn() },
    providerWebhookEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
    unmatchedProviderStatus: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    campaignRecipient: { findUnique: vi.fn() },
  },
}));

vi.mock('../../realtime', () => ({ emitToOrg: vi.fn() }));
vi.mock('../campaigns/service', () => ({ syncCampaignRecipientFromWebhook: vi.fn() }));
vi.mock('../automation/engine', () => ({ handleInboundAutomations: vi.fn() }));
vi.mock('../media/download.service', () => ({ downloadAndStoreMessageMedia: vi.fn() }));
vi.mock('../inbox/message-parser', () => ({
  parseInboundMessage: vi.fn(() => ({ content: 'hello' })),
}));
vi.mock('../billing/entitlements.service', () => ({
  checkQuota: vi.fn().mockResolvedValue({ allowed: true, used: 0, limit: 100 }),
}));
vi.mock('../../errors', () => ({ logError: vi.fn() }));
vi.mock('../integrations/dispatch', () => ({ dispatchOrgWebhook: vi.fn() }));
vi.mock('../compliance/opt-out', () => ({
  isOptOutMessage: () => false,
  isOptInMessage: () => false,
  handleOptOut: vi.fn(),
  handleOptIn: vi.fn(),
}));
vi.mock('./meta.service', () => ({
  MetaWhatsAppService: { decryptToken: vi.fn(() => 'token') },
}));

const channelMock = vi.mocked(prisma.channel);
const events = vi.mocked(prisma.providerWebhookEvent);
const whatsappNumberMock = vi.mocked(prisma.whatsappNumber);
const conversationMock = vi.mocked(prisma.conversation);
const contactMock = vi.mocked(prisma.contact);

function pageLeadgenFixture(leadgenId = 'lead_1', pageId = 'page_1') {
  return {
    object: 'page',
    entry: [
      {
        id: pageId,
        time: 1_700_000_000,
        changes: [
          {
            field: 'leadgen',
            value: {
              leadgen_id: leadgenId,
              page_id: pageId,
              form_id: 'form_1',
              created_time: 1_700_000_000,
            },
          },
        ],
      },
    ],
  };
}

function wabaInboundFixture(phoneNumberId = 'phone-1') {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: phoneNumberId },
              contacts: [{ wa_id: '9198', profile: { name: 'A' } }],
              messages: [
                {
                  id: 'wamid.phase0',
                  from: '9198',
                  timestamp: '1700000000',
                  type: 'text',
                  text: { body: 'hello' },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  channelMock.findMany.mockResolvedValue([
    { id: 'ch-1', organizationId: 'org-1' },
  ] as never);
  events.create.mockResolvedValue({ id: 'evt-1' } as never);
  events.updateMany.mockResolvedValue({ count: 1 } as never);
  whatsappNumberMock.findFirst.mockResolvedValue({
    id: 'wa-1',
    organizationId: 'org-1',
    phoneNumberId: 'phone-1',
    accessToken: 'enc',
    isActive: true,
  } as never);
});

describe('Phase 0 Meta webhook object router', () => {
  it('keeps attachment-only Page messages instead of silently dropping them', () => {
    expect(channelMessageAttachment({
      attachments: [{ type: 'image', payload: { url: 'https://cdn.example/image.jpg' } }],
    })).toEqual({
      type: 'IMAGE',
      content: '[image]',
      metadata: {
        attachments: [{ type: 'image', payload: { url: 'https://cdn.example/image.jpg' } }],
        externalUrl: 'https://cdn.example/image.jpg',
        filename: 'image.jpg',
        mimeType: 'image/jpeg',
      },
    });
    expect(channelMessageAttachment({
      attachments: [{ type: 'image', payload: { url: 'https://cdn.example/anim.gif?oe=1' } }],
    })).toMatchObject({
      type: 'IMAGE',
      content: '[image]',
      metadata: { isGif: true, mimeType: 'image/gif' },
    });
    expect(channelMessageAttachment({
      attachments: [{ type: 'video', payload: { url: 'https://cdn.example/clip.mp4' } }],
    })).toMatchObject({ type: 'VIDEO', content: '[video]' });
    expect(channelMessageAttachment({
      attachments: [{ type: 'file', payload: { url: 'https://cdn.example/quote.pdf' } }],
    })).toMatchObject({
      type: 'DOCUMENT',
      content: '[document]',
      metadata: { mimeType: 'application/pdf', filename: 'quote.pdf' },
    });
    expect(channelMessageAttachment({
      attachments: [{ type: 'ig_reel', payload: { url: 'https://cdn.example/reel.mp4' } }],
    })).toMatchObject({ type: 'VIDEO', content: '[video]' });
    expect(channelMessageAttachment({ attachments: [{ type: 'file', payload: {} }] })).toEqual({
      type: 'DOCUMENT',
      content: '[DOCUMENT]',
      metadata: { attachments: [{ type: 'file', payload: {} }] },
    });
  });

  it('keeps the WhatsApp WABA path resolving the active number (no early drop)', async () => {
    // Transaction can fail later; the regression gate is that WABA still enters number lookup.
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error('stop after number resolve'));
    await expect(processWebhookPayload(wabaInboundFixture())).rejects.toThrow(
      'stop after number resolve'
    );
    expect(whatsappNumberMock.findFirst).toHaveBeenCalledWith({
      where: { phoneNumberId: 'phone-1', isActive: true },
    });
  });

  it('does not create a WhatsApp conversation for a page/leadgen fixture', async () => {
    const payload = pageLeadgenFixture();
    const result = await dispatchPageWebhookFields(payload);
    await processWebhookPayload(payload);

    expect(result.claimed).toBe(1);
    expect(result.unmatched).toBe(0);
    expect(channelMock.findMany).toHaveBeenCalledWith({
      where: { platform: 'FB', platformAccountId: 'page_1', isActive: true },
      select: { id: true, organizationId: true, accessToken: true },
      take: 2,
    });
    expect(events.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        eventKey: 'leadgen:lead_1',
        field: 'leadgen',
        status: 'PROCESSING',
      }),
    });
    expect(providerWebhookEventKey('page_1', 'leadgen', {
      leadgen_id: 'lead_1',
      page_id: 'page_1',
      form_id: 'form_1',
      created_time: 1_700_000_000,
    })).toBe('leadgen:lead_1');
    expect(whatsappNumberMock.findFirst).not.toHaveBeenCalled();
    expect(conversationMock.upsert).not.toHaveBeenCalled();
    expect(conversationMock.create).not.toHaveBeenCalled();
    expect(contactMock.upsert).not.toHaveBeenCalled();
    expect(contactMock.create).not.toHaveBeenCalled();
  });

  it('treats a duplicate page/leadgen claim for a resolved org as idempotent', async () => {
    const payload = pageLeadgenFixture('lead_dup');
    const first = await dispatchPageWebhookFields(payload);
    expect(first.claimed).toBe(1);
    expect(events.updateMany).toHaveBeenCalledTimes(1);

    events.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
      })
    );
    events.findUnique.mockResolvedValue({
      id: 'evt-1',
      status: 'COMPLETED',
      claimedAt: new Date(),
    } as never);

    const second = await dispatchPageWebhookFields(payload);
    expect(second.claimed).toBe(0);
    expect(second.duplicates).toBe(1);
    // complete() only from the first successful claim
    expect(events.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not persist when no Channel matches the Page', async () => {
    channelMock.findMany.mockResolvedValue([] as never);
    const result = await dispatchPageWebhookFields(pageLeadgenFixture());
    expect(result).toEqual({ claimed: 0, unmatched: 1, duplicates: 0 });
    expect(events.create).not.toHaveBeenCalled();
  });
});
