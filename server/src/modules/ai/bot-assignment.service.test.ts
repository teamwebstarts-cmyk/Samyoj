import { describe, expect, it, vi, beforeEach } from 'vitest';
import prisma from '../../config/database';
import {
  appliedBotIdsForNumber,
  applyAllConversationWhere,
  applyBotToAllChats,
  disableNonManualChatsForNumber,
  nonManualConversationWhere,
  removeAppliedConversationWhere,
  removeBotFromAllChats,
} from './bot-assignment.service';

vi.mock('../../config/database', () => ({
  default: {
    aiBot: { findFirst: vi.fn() },
    conversation: { updateMany: vi.fn(), findMany: vi.fn() },
  },
}));

const aiBotMock = vi.mocked(prisma.aiBot);
const conversationMock = vi.mocked(prisma.conversation);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('applyAllConversationWhere', () => {
  it('includes all chats on the number when includeManual is true', () => {
    expect(applyAllConversationWhere('org-1', 'wa-1', true)).toEqual({
      organizationId: 'org-1',
      whatsappNumberId: 'wa-1',
    });
  });

  it('excludes MANUAL when includeManual is false', () => {
    expect(applyAllConversationWhere('org-1', 'wa-1', false)).toEqual({
      organizationId: 'org-1',
      whatsappNumberId: 'wa-1',
      OR: [{ botAssignmentSource: null }, { botAssignmentSource: 'APPLIED' }],
    });
  });
});

describe('nonManualConversationWhere', () => {
  it('matches every chat except MANUAL picks', () => {
    expect(nonManualConversationWhere('org-1', 'wa-1')).toEqual({
      organizationId: 'org-1',
      whatsappNumberId: 'wa-1',
      NOT: { botAssignmentSource: 'MANUAL' },
    });
  });
});

describe('removeAppliedConversationWhere', () => {
  it('only matches APPLIED rows for that bot', () => {
    expect(removeAppliedConversationWhere('org-1', 'wa-1', 'bot-a')).toEqual({
      organizationId: 'org-1',
      whatsappNumberId: 'wa-1',
      botAssignmentSource: 'APPLIED',
      activeBotId: 'bot-a',
    });
  });
});

describe('applyBotToAllChats', () => {
  it('sets APPLIED on all chats including MANUAL by default', async () => {
    aiBotMock.findFirst.mockResolvedValue({ id: 'bot-a', channel: 'CHAT' } as never);
    conversationMock.updateMany.mockResolvedValue({ count: 4 } as never);

    await expect(
      applyBotToAllChats({
        organizationId: 'org-1',
        whatsappNumberId: 'wa-1',
        botId: 'bot-a',
      })
    ).resolves.toEqual({ updated: 4 });

    expect(conversationMock.updateMany).toHaveBeenCalledWith({
      where: applyAllConversationWhere('org-1', 'wa-1', true),
      data: {
        activeBotId: 'bot-a',
        botAssignmentSource: 'APPLIED',
        botActive: true,
      },
    });
  });

  it('fails closed without a WhatsApp number id', async () => {
    await expect(
      applyBotToAllChats({
        organizationId: 'org-1',
        whatsappNumberId: '',
        botId: 'bot-a',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(conversationMock.updateMany).not.toHaveBeenCalled();
  });

  it('rejects calling bots so Inbox apply-all stays chat-only', async () => {
    aiBotMock.findFirst.mockResolvedValue({ id: 'call-1', channel: 'CALL' } as never);
    await expect(
      applyBotToAllChats({
        organizationId: 'org-1',
        whatsappNumberId: 'wa-1',
        botId: 'call-1',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(conversationMock.updateMany).not.toHaveBeenCalled();
  });
});

describe('disableNonManualChatsForNumber', () => {
  it('pauses and clears assignment on non-MANUAL chats', async () => {
    conversationMock.updateMany.mockResolvedValue({ count: 3 } as never);
    await expect(disableNonManualChatsForNumber('org-1', 'wa-1')).resolves.toEqual({ updated: 3 });
    expect(conversationMock.updateMany).toHaveBeenCalledWith({
      where: nonManualConversationWhere('org-1', 'wa-1'),
      data: {
        activeBotId: null,
        botAssignmentSource: null,
        botActive: false,
      },
    });
  });
});

describe('removeBotFromAllChats', () => {
  it('reverts APPLIED rows and pauses them', async () => {
    aiBotMock.findFirst.mockResolvedValue({ id: 'bot-a', channel: 'CHAT' } as never);
    conversationMock.updateMany.mockResolvedValue({ count: 2 } as never);

    await expect(
      removeBotFromAllChats({
        organizationId: 'org-1',
        whatsappNumberId: 'wa-1',
        botId: 'bot-a',
      })
    ).resolves.toEqual({ updated: 2 });

    expect(conversationMock.updateMany).toHaveBeenCalledWith({
      where: removeAppliedConversationWhere('org-1', 'wa-1', 'bot-a'),
      data: {
        activeBotId: null,
        botAssignmentSource: null,
        botActive: false,
      },
    });
  });
});

describe('appliedBotIdsForNumber', () => {
  it('returns bot ids that have APPLIED rows on this number', async () => {
    conversationMock.findMany.mockResolvedValue([{ activeBotId: 'bot-a' }] as never);

    await expect(appliedBotIdsForNumber('org-1', 'wa-1')).resolves.toEqual(new Set(['bot-a']));
  });

  it('returns empty when the number id is missing', async () => {
    await expect(appliedBotIdsForNumber('org-1', '')).resolves.toEqual(new Set());
    expect(conversationMock.findMany).not.toHaveBeenCalled();
  });
});
