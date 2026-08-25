import { describe, expect, it, beforeEach, vi } from 'vitest';

/* ── Mock dependencies ──────────────────────────────────────────────── */

vi.mock('../../config/database', () => ({
  default: {
    contact: { upsert: vi.fn(), findUnique: vi.fn() },
    conversation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    message: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../billing/entitlements.service', () => ({
  checkQuota: vi.fn().mockResolvedValue({ allowed: true, used: 0, limit: 100 }),
  getOrgEntitlements: vi.fn().mockResolvedValue({ isLocked: false }),
}));

vi.mock('../../utils/phone', () => ({
  validatePhone: vi.fn(),
  normalizePhone: (s: string) => s,
  normalizePhoneIdentity: (s: string) => s,
  phoneFieldSchema: { _def: {} },
}));

vi.mock('../campaigns/service', () => ({
  finalizeCampaignIfDone: vi.fn(),
  syncRunningCampaignStatuses: vi.fn(),
}));

vi.mock('../whatsapp/context', () => ({
  getOrgWhatsappContext: vi.fn(),
}));

vi.mock('../whatsapp/meta.service', () => ({
  MetaWhatsAppService: {
    sendMessage: vi.fn(),
    getMessageTemplate: vi.fn(),
    decryptToken: vi.fn((t: string) => t),
  },
  getTemplateDisplayText: vi.fn().mockReturnValue('Template body'),
  isWithin24HourWindow: vi.fn(),
}));

vi.mock('./send.service', () => ({
  deliverOutboundMessage: vi.fn(),
}));

vi.mock('../../realtime', () => ({
  emitToOrg: vi.fn(),
}));

vi.mock('../platform/events', () => ({
  emitProductEvent: vi.fn(),
}));

vi.mock('../whatsapp/provider-status', () => ({
  reconcileUnmatchedProviderStatuses: vi.fn().mockResolvedValue(undefined),
}));

/* ── Imports (after mocks) ───────────────────────────────────────────── */

import prisma from '../../config/database';
import { validatePhone } from '../../utils/phone';
import { getOrgWhatsappContext } from '../whatsapp/context';
import { isWithin24HourWindow } from '../whatsapp/meta.service';
import { deliverOutboundMessage } from './send.service';
import { emitToOrg } from '../../realtime';
import { emitProductEvent } from '../platform/events';
import { recordOutboundInConversation, sendDirectMessage } from './service';

const mockPhone = vi.mocked(validatePhone);
const mockContext = vi.mocked(getOrgWhatsappContext);
const mockWindow = vi.mocked(isWithin24HourWindow);
const mockDeliver = vi.mocked(deliverOutboundMessage);
const mockTransaction = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

/* ── Helpers ────────────────────────────────────────────────────────── */

const orgId = 'org-1';
const waNumberId = 'wa-1';
const contactId = 'contact-1';
const conversationId = 'conv-1';
const messageId = 'msg-1';

function validPhoneResult() {
  return { ok: true as const, phone: '919876543210' };
}

function mockContact() {
  return { id: contactId, name: 'Test', normalizedPhone: '919876543210' };
}

function mockConversation() {
  return { id: conversationId, organizationId: orgId, contactId, whatsappNumberId: waNumberId };
}

function mockMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: messageId,
    conversationId,
    direction: 'OUTBOUND',
    type: 'TEXT',
    content: 'Hello',
    status: 'SENT',
    createdAt: new Date(),
    ...overrides,
  };
}

/* ── Tests ──────────────────────────────────────────────────────────── */

describe('recordOutboundInConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPhone.mockReturnValue(validPhoneResult());
    mockTransaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          $queryRaw: vi.fn(),
          contact: {
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: prisma.contact.upsert,
          },
        })
    );
  });

  it('creates contact + conversation + message and returns them', async () => {
    const contact = mockContact();
    const conversation = mockConversation();
    const message = mockMessage();

    (prisma.contact.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(contact);
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.conversation.create as ReturnType<typeof vi.fn>).mockResolvedValue(conversation);
    (prisma.message.create as ReturnType<typeof vi.fn>).mockResolvedValue(message);
    (prisma.conversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.conversation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: conversationId,
      lastMessageAt: new Date(),
      unreadCount: 0,
    });

    const result = await recordOutboundInConversation({
      organizationId: orgId,
      whatsappNumberId: waNumberId,
      phone: '919876543210',
      content: 'Hello',
    });

    expect(result.contact).toEqual(contact);
    expect(result.conversation).toEqual(conversation);
    expect(result.message).toEqual(message);
    expect(prisma.contact.upsert).toHaveBeenCalled();
    expect(prisma.conversation.create).toHaveBeenCalled();
    expect(prisma.message.create).toHaveBeenCalled();
  });

  it('reuses existing conversation instead of creating a new one', async () => {
    const contact = mockContact();
    const conversation = mockConversation();
    const message = mockMessage();

    (prisma.contact.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(contact);
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(conversation);
    (prisma.message.create as ReturnType<typeof vi.fn>).mockResolvedValue(message);
    (prisma.conversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.conversation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: conversationId,
      lastMessageAt: new Date(),
      unreadCount: 0,
    });

    const result = await recordOutboundInConversation({
      organizationId: orgId,
      whatsappNumberId: waNumberId,
      phone: '919876543210',
      content: 'Hello again',
    });

    expect(result.conversation.id).toBe(conversationId);
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it('emits message:new and MESSAGE_OUT event', async () => {
    const contact = mockContact();
    const conversation = mockConversation();
    const message = mockMessage();

    (prisma.contact.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(contact);
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(conversation);
    (prisma.message.create as ReturnType<typeof vi.fn>).mockResolvedValue(message);
    (prisma.conversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.conversation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: conversationId,
      lastMessageAt: new Date(),
      unreadCount: 0,
    });

    await recordOutboundInConversation({
      organizationId: orgId,
      whatsappNumberId: waNumberId,
      phone: '919876543210',
      content: 'Hello',
    });

    expect(emitToOrg).toHaveBeenCalledWith(orgId, 'message:new', expect.objectContaining({
      conversationId,
      message,
    }));
    expect(emitProductEvent).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: orgId, name: 'MESSAGE_OUT' })
    );
  });

  it('throws 400 on invalid phone number', async () => {
    mockPhone.mockReturnValue({ ok: false, error: 'Phone number is too short' });

    await expect(
      recordOutboundInConversation({
        organizationId: orgId,
        whatsappNumberId: waNumberId,
        phone: '123',
        content: 'Hello',
      })
    ).rejects.toThrow(/phone number is too short/i);
  });

  it('backs whatsappNumberId onto existing conversation missing it', async () => {
    const contact = mockContact();
    const conversationWithoutWa = { ...mockConversation(), whatsappNumberId: null };
    const message = mockMessage();

    (prisma.contact.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(contact);
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(conversationWithoutWa);
    (prisma.conversation.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockConversation());
    (prisma.message.create as ReturnType<typeof vi.fn>).mockResolvedValue(message);
    (prisma.conversation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: conversationId,
      lastMessageAt: new Date(),
      unreadCount: 0,
    });

    await recordOutboundInConversation({
      organizationId: orgId,
      whatsappNumberId: waNumberId,
      phone: '919876543210',
      content: 'Hello',
    });

    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: conversationId },
        data: { whatsappNumberId: waNumberId },
      })
    );
  });
});

describe('sendDirectMessage', () => {
  const waNumber = {
    id: waNumberId,
    phoneNumberId: 'pn-1',
    accessToken: 'encrypted-token',
    wabaId: 'waba-1',
    isActive: true,
    organizationId: orgId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPhone.mockReturnValue(validPhoneResult());
    mockTransaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          $queryRaw: vi.fn(),
          contact: {
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: prisma.contact.upsert,
          },
        })
    );
    mockContext.mockResolvedValue({
      whatsappNumber: waNumber,
      wabaId: 'waba-1',
      accessToken: 'decrypted-token',
    } as never);
  });

  it('sends a text message within the 24-hour window', async () => {
    const contact = mockContact();
    const conversation = { ...mockConversation(), messages: [{ createdAt: new Date() }] };
    const message = mockMessage({ status: 'PENDING' });
    const sentMessage = mockMessage({ status: 'SENT', metaMessageId: 'meta-123' });

    (prisma.contact.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(contact);
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(conversation);
    (prisma.message.create as ReturnType<typeof vi.fn>).mockResolvedValue(message);
    (prisma.conversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    mockWindow.mockReturnValue(true);
    mockDeliver.mockResolvedValue(sentMessage as never);

    const result = await sendDirectMessage(orgId, {
      phone: '919876543210',
      content: 'Hello from inbox',
    });

    expect(result.message).toEqual(sentMessage);
    expect(mockDeliver).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: orgId,
      whatsappNumberId: waNumberId,
      phoneNumberId: 'pn-1',
      to: '919876543210',
      content: 'Hello from inbox',
      type: 'TEXT',
    }));
  });

  it('rejects text message outside the 24-hour window', async () => {
    const contact = mockContact();
    const conversation = { ...mockConversation(), messages: [{ createdAt: new Date('2020-01-01') }] };

    (prisma.contact.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(contact);
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(conversation);
    mockWindow.mockReturnValue(false);

    await expect(
      sendDirectMessage(orgId, {
        phone: '919876543210',
        content: 'Stale message',
      })
    ).rejects.toThrow(/24-hour window/i);
  });

  it('sends template message without 24-hour window check', async () => {
    const contact = mockContact();
    const conversation = { ...mockConversation(), messages: [] };
    const message = mockMessage({ status: 'PENDING', type: 'TEMPLATE' });
    const sentMessage = mockMessage({ status: 'SENT', type: 'TEMPLATE', metaMessageId: 'meta-tpl' });

    (prisma.contact.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(contact);
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(conversation);
    (prisma.message.create as ReturnType<typeof vi.fn>).mockResolvedValue(message);
    (prisma.conversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    mockDeliver.mockResolvedValue(sentMessage as never);

    const result = await sendDirectMessage(orgId, {
      phone: '919876543210',
      content: 'Template body',
      type: 'TEMPLATE',
      templateName: 'hello_world',
      templateLanguage: 'en_US',
    });

    expect(result.message).toEqual(sentMessage);
    expect(mockDeliver).toHaveBeenCalledWith(expect.objectContaining({
      type: 'TEMPLATE',
      templateName: 'hello_world',
      templateLanguage: 'en_US',
    }));
  });

  it('creates a new conversation when none exists', async () => {
    const contact = mockContact();
    const message = mockMessage({ status: 'PENDING' });
    const sentMessage = mockMessage({ status: 'SENT', metaMessageId: 'meta-new' });
    const newConv = { ...mockConversation(), messages: [] };

    (prisma.contact.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(contact);
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.conversation.create as ReturnType<typeof vi.fn>).mockResolvedValue(newConv);
    (prisma.message.create as ReturnType<typeof vi.fn>).mockResolvedValue(message);
    (prisma.conversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    mockWindow.mockReturnValue(true);
    mockDeliver.mockResolvedValue(sentMessage as never);

    await sendDirectMessage(orgId, {
      phone: '919876543210',
      content: 'First message',
    });

    expect(prisma.conversation.create).toHaveBeenCalled();
  });

  it('throws 400 on invalid phone number', async () => {
    mockPhone.mockReturnValue({ ok: false, error: 'Phone number is too short' });

    await expect(
      sendDirectMessage(orgId, { phone: '123', content: 'Hello' })
    ).rejects.toThrow(/phone number is too short/i);
  });

  it('throws when no WhatsApp number is connected', async () => {
    const contact = mockContact();
    (prisma.contact.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(contact);
    mockContext.mockRejectedValue(new Error('No WhatsApp number connected'));

    await expect(
      sendDirectMessage(orgId, { phone: '919876543210', content: 'Hello' })
    ).rejects.toThrow(/no whatsapp number/i);
  });
});
