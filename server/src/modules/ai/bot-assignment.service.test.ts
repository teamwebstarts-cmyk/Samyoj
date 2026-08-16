import { describe, expect, it, vi, beforeEach } from 'vitest';
import prisma from '../../config/database';
import {
  appliedBotIdsForNumber,
  applyAllConversationWhere,
  applyBotToAllChats,
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
  it('includes follow-default (null source) and APPLIED, not MANUAL', () => {
    expect(applyAllConversationWhere('org-1', 'wa-1')).toEqual({
      organizationId: 'org-1',
      whatsappNumberId: 'wa-1',
      OR: [{ botAssignmentSource: null }, { botAssignmentSource: 'APPLIED' }],
    });
  });

  it('does not use NOT MANUAL (SQL NULL would skip follow-default chats)', () => {
    const where = applyAllConversationWhere('org-1', 'wa-1');
    expect(JSON.stringify(where)).not.toMatch(/"not"\s*:/);
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
  it('sets APPLIED on non-MANUAL chats for this number only', async () => {
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
      where: applyAllConversationWhere('org-1', 'wa-1'),
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

  it('404s when the bot is not in this org', async () => {
    aiBotMock.findFirst.mockResolvedValue(null);
    await expect(
      applyBotToAllChats({
        organizationId: 'org-1',
        whatsappNumberId: 'wa-1',
        botId: 'bot-x',
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('removeBotFromAllChats', () => {
  it('reverts only APPLIED rows for that bot; MANUAL stays', async () => {
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
      },
    });
  });
});

describe('appliedBotIdsForNumber', () => {
  it('returns bot ids that have APPLIED rows on this number', async () => {
    conversationMock.findMany.mockResolvedValue([{ activeBotId: 'bot-a' }] as never);

    await expect(appliedBotIdsForNumber('org-1', 'wa-1')).resolves.toEqual(new Set(['bot-a']));
    expect(conversationMock.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        whatsappNumberId: 'wa-1',
        botAssignmentSource: 'APPLIED',
        activeBotId: { not: null },
      },
      select: { activeBotId: true },
      distinct: ['activeBotId'],
    });
  });

  it('returns empty when the number id is missing', async () => {
    await expect(appliedBotIdsForNumber('org-1', '')).resolves.toEqual(new Set());
    expect(conversationMock.findMany).not.toHaveBeenCalled();
  });
});
