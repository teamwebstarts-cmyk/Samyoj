import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../config/database';
import { processWebhookPayload } from './webhook.processor';

vi.mock('../config/database', () => ({
  default: {
    whatsappNumber: { findFirst: vi.fn() },
    message: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    contact: { upsert: vi.fn() },
    conversation: {
      findUnique: vi.fn(),
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
vi.mock('../errors', () => ({ logError: vi.fn() }));

const whatsappNumberMock = vi.mocked(prisma.whatsappNumber);
const conversationMock = vi.mocked(prisma.conversation);
const contactMock = vi.mocked(prisma.contact);

beforeEach(() => {
  vi.clearAllMocks();
  whatsappNumberMock.findFirst.mockResolvedValue({
    id: 'wa-1',
    organizationId: 'org-1',
    phoneNumberId: 'phone-1',
    accessToken: 'enc',
    isActive: true,
  } as never);
});

describe('processWebhookPayload inbound durability', () => {
  it('repairs conversation side-effects when a duplicate metaMessageId insert wins after a crash', async () => {
    const inboundAt = 1700000000;
    contactMock.upsert.mockResolvedValue({ id: 'contact-1' } as never);
    conversationMock.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ lastMessageAt: null, firstResponseAt: null, slaDueAt: null } as never);
    conversationMock.upsert.mockResolvedValue({ id: 'conv-1' } as never);
    vi.mocked(prisma.$transaction as unknown as { mockRejectedValue: (value: unknown) => void }).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
      })
    );
    vi.mocked(prisma.message.findFirst).mockResolvedValue({ conversationId: 'conv-1' } as never);
    conversationMock.updateMany.mockResolvedValue({ count: 1 } as never);

    await processWebhookPayload({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'phone-1' },
                contacts: [{ wa_id: '9198', profile: { name: 'A' } }],
                messages: [
                  {
                    id: 'wamid.dup',
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
    });

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
  });
});
