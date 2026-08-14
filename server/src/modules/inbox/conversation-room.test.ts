import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../config/database';
import { conversationRoomAllowed, parseConversationJoinPayload } from './conversation-room';

vi.mock('../../config/database', () => ({
  default: {
    conversation: { findFirst: vi.fn() },
    whatsappNumber: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

const conversationMock = vi.mocked(prisma.conversation);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseConversationJoinPayload', () => {
  it('accepts a legacy string conversation id', () => {
    expect(parseConversationJoinPayload('conv-1')).toEqual({ conversationId: 'conv-1' });
  });

  it('accepts an object payload with an optional WhatsApp number', () => {
    expect(
      parseConversationJoinPayload({ conversationId: 'conv-1', whatsappNumberId: 'wa-1' })
    ).toEqual({ conversationId: 'conv-1', whatsappNumberId: 'wa-1' });
  });

  it('rejects empty or malformed payloads', () => {
    expect(parseConversationJoinPayload('')).toBeNull();
    expect(parseConversationJoinPayload({})).toBeNull();
    expect(parseConversationJoinPayload(null)).toBeNull();
  });
});

describe('conversationRoomAllowed', () => {
  it('never allows a join without an active WhatsApp number', async () => {
    await expect(conversationRoomAllowed('conv-1', 'org-1', undefined)).resolves.toBe(false);
    expect(conversationMock.findFirst).not.toHaveBeenCalled();
  });

  it('requires the conversation to belong to the org and active number', async () => {
    conversationMock.findFirst.mockResolvedValue({ id: 'conv-1' } as never);
    await expect(conversationRoomAllowed('conv-1', 'org-1', 'wa-1')).resolves.toBe(true);
    expect(conversationMock.findFirst).toHaveBeenCalledWith({
      where: { id: 'conv-1', organizationId: 'org-1', whatsappNumberId: 'wa-1' },
      select: { id: true },
    });
  });

  it('denies a conversation from another number in the same org', async () => {
    conversationMock.findFirst.mockResolvedValue(null);
    await expect(conversationRoomAllowed('conv-1', 'org-1', 'wa-other')).resolves.toBe(false);
  });
});
