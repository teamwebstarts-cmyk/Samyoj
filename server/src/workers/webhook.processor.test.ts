import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../config/database';
import { handleInboundAutomations } from '../modules/automation/engine';
import { downloadAndStoreMessageMedia } from '../modules/media/download.service';
import { parseInboundMessage } from '../modules/inbox/message-parser';
import { processWebhookPayload } from './webhook.processor';

vi.mock('../config/database', () => ({
  default: {
    whatsappNumber: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
    message: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    contact: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    conversation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
    unmatchedProviderStatus: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    campaignRecipient: { findUnique: vi.fn() },
  },
}));

vi.mock('../realtime', () => ({ emitToOrg: vi.fn() }));
vi.mock('../modules/campaigns/service', () => ({
  syncCampaignRecipientFromWebhook: vi.fn(),
}));
vi.mock('../modules/automation/engine', () => ({ handleInboundAutomations: vi.fn() }));
vi.mock('../modules/media/download.service', () => ({ downloadAndStoreMessageMedia: vi.fn() }));
vi.mock('../modules/inbox/message-parser', () => ({
  parseInboundMessage: vi.fn(() => ({ content: 'hello' })),
}));
vi.mock('../modules/billing/entitlements.service', () => ({
  checkQuota: vi.fn().mockResolvedValue({ allowed: true, used: 0, limit: 100 }),
}));
vi.mock('../errors', () => ({ logError: vi.fn() }));
vi.mock('../modules/integrations/dispatch', () => ({ dispatchOrgWebhook: vi.fn() }));
vi.mock('../modules/compliance/opt-out', () => ({
  isOptOutMessage: () => false,
  isOptInMessage: () => false,
  handleOptOut: vi.fn(),
  handleOptIn: vi.fn(),
}));
vi.mock('../modules/whatsapp/meta.service', () => ({
  MetaWhatsAppService: { decryptToken: vi.fn(() => 'token') },
}));

const whatsappNumberMock = vi.mocked(prisma.whatsappNumber);
const conversationMock = vi.mocked(prisma.conversation);
const contactMock = vi.mocked(prisma.contact);

function duplicateWebhook(phoneNumberId: string, metaMessageId = 'wamid.dup', inboundAt = 1700000000) {
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
                  id: metaMessageId,
                  from: '9198',
                  timestamp: String(inboundAt),
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

async function mockDuplicateInsertPath() {
  contactMock.upsert.mockResolvedValue({ id: 'contact-1' } as never);
  conversationMock.findUnique.mockResolvedValue({
    lastMessageAt: null,
    firstResponseAt: null,
    slaDueAt: null,
    id: 'conv-1',
    unreadCount: 0,
  } as never);
  conversationMock.findMany.mockResolvedValue([] as never);
  conversationMock.upsert.mockResolvedValue({ id: 'conv-1' } as never);
  const duplicateError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.0.0',
  });
  vi.mocked(prisma.$transaction)
    .mockImplementationOnce(async (callback) =>
      callback({
        $queryRaw: vi.fn(),
        contact: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: contactMock.upsert,
          update: contactMock.update,
        },
      } as never)
    )
    .mockRejectedValueOnce(duplicateError);
  vi.mocked(prisma.message.findFirst).mockResolvedValue({
    id: 'msg-1',
    conversationId: 'conv-1',
    direction: 'INBOUND',
    type: 'TEXT',
    content: 'hello',
    createdAt: new Date(),
    status: 'DELIVERED',
    metadata: {},
  } as never);
  conversationMock.updateMany.mockResolvedValue({ count: 1 } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  whatsappNumberMock.findFirst.mockResolvedValue({
    id: 'wa-1',
    organizationId: 'org-1',
    phoneNumberId: 'phone-1',
    accessToken: 'enc',
    isActive: true,
  } as never);
  contactMock.findUnique.mockResolvedValue(null as never);
  contactMock.update.mockResolvedValue({ id: 'contact-1' } as never);
  contactMock.updateMany.mockResolvedValue({ count: 1 } as never);
  vi.mocked(prisma.organization.findUnique).mockResolvedValue({ settings: {} } as never);
});

describe('processWebhookPayload inbound durability', () => {
  it('repairs conversation side-effects when a duplicate metaMessageId insert wins after a crash', async () => {
    const inboundAt = 1700000000;
    await mockDuplicateInsertPath();
    await processWebhookPayload(duplicateWebhook('phone-1', 'wamid.dup', inboundAt));

    expect(conversationMock.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'conv-1',
        OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: new Date(inboundAt * 1000) } }],
      },
      data: expect.objectContaining({
        lastMessageAt: new Date(inboundAt * 1000),
        unreadCount: { increment: 1 },
      }),
    });
    expect(handleInboundAutomations).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: 'msg-1', conversationId: 'conv-1' })
    );
  });

  it('does not create a second message across many duplicate payloads', async () => {
    for (let i = 0; i < 20; i += 1) {
      await mockDuplicateInsertPath();
      await processWebhookPayload(duplicateWebhook('phone-1'));
    }
    expect(vi.mocked(prisma.message.create)).not.toHaveBeenCalled();
    expect(handleInboundAutomations).toHaveBeenCalled();
  });

  it('resumes media download when the duplicate row has mediaId but no mediaPath', async () => {
    await mockDuplicateInsertPath();
    vi.mocked(parseInboundMessage).mockReturnValue({
      content: '',
      metadata: { mediaId: 'mid-1', mimeType: 'image/jpeg' },
    } as never);
    vi.mocked(prisma.message.findFirst).mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-1',
      direction: 'INBOUND',
      type: 'IMAGE',
      content: '',
      createdAt: new Date(),
      status: 'DELIVERED',
      metadata: { mediaId: 'mid-1' },
    } as never);
    vi.mocked(downloadAndStoreMessageMedia).mockResolvedValue({
      mediaId: 'mid-1',
      mediaPath: 'org/msg.jpg',
    } as never);
    vi.mocked(prisma.message.update).mockResolvedValue({ id: 'msg-1' } as never);

    await processWebhookPayload(duplicateWebhook('phone-1'));
    expect(downloadAndStoreMessageMedia).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: 'msg-1', mediaId: 'mid-1' })
    );
  });

  it('looks up each phone_number_id even when a stale first-entry number is supplied', async () => {
    whatsappNumberMock.findFirst
      .mockResolvedValueOnce({
        id: 'wa-1',
        organizationId: 'org-1',
        phoneNumberId: 'phone-1',
        accessToken: 'enc',
        isActive: true,
      } as never)
      .mockResolvedValueOnce({
        id: 'wa-2',
        organizationId: 'org-1',
        phoneNumberId: 'phone-2',
        accessToken: 'enc',
        isActive: true,
      } as never);

    await processWebhookPayload(
      {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: { metadata: { phone_number_id: 'phone-1' }, messages: [] },
              },
            ],
          },
          {
            changes: [
              {
                field: 'messages',
                value: { metadata: { phone_number_id: 'phone-2' }, messages: [] },
              },
            ],
          },
        ],
      },
      { whatsappNumberId: 'wa-1' }
    );

    expect(whatsappNumberMock.findFirst).toHaveBeenCalledTimes(2);
    expect(whatsappNumberMock.findFirst).toHaveBeenNthCalledWith(1, {
      where: { phoneNumberId: 'phone-1', isActive: true },
    });
    expect(whatsappNumberMock.findFirst).toHaveBeenNthCalledWith(2, {
      where: { phoneNumberId: 'phone-2', isActive: true },
    });
  });
});
