import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  orgFind: vi.fn(),
  orgUpdate: vi.fn(),
  convFindMany: vi.fn(),
  convFindFirst: vi.fn(),
  convFindUnique: vi.fn(),
  convUpdate: vi.fn(),
  convUpdateMany: vi.fn(),
  applyBotToAllChats: vi.fn(),
  disableNonManualChatsForNumber: vi.fn(),
  appliedBotIdsForNumber: vi.fn(),
  emitToOrg: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  default: {
    organization: {
      findUnique: mocks.orgFind,
      update: mocks.orgUpdate,
    },
    conversation: {
      findMany: mocks.convFindMany,
      findFirst: mocks.convFindFirst,
      findUnique: mocks.convFindUnique,
      update: mocks.convUpdate,
      updateMany: mocks.convUpdateMany,
    },
  },
}));

vi.mock('../ai/bot-assignment.service', () => ({
  applyBotToAllChats: mocks.applyBotToAllChats,
  disableNonManualChatsForNumber: mocks.disableNonManualChatsForNumber,
  appliedBotIdsForNumber: mocks.appliedBotIdsForNumber,
}));

vi.mock('../../realtime', () => ({
  emitToOrg: mocks.emitToOrg,
}));

import {
  disableGlobalChatAi,
  enableGlobalChatAi,
} from './chat-settings.service';

describe('chat-settings global/personal snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orgFind.mockResolvedValue({ settings: { chat: { byNumber: {} } } });
    mocks.orgUpdate.mockResolvedValue({});
    mocks.appliedBotIdsForNumber.mockResolvedValue(new Set());
    mocks.applyBotToAllChats.mockResolvedValue({ updated: 3 });
    mocks.disableNonManualChatsForNumber.mockResolvedValue({ updated: 2 });
    mocks.convFindMany.mockResolvedValue([
      { id: 'conv-manual', activeBotId: 'bot-personal' },
    ]);
    mocks.convUpdateMany.mockResolvedValue({ count: 1 });
    mocks.convFindUnique.mockResolvedValue({
      id: 'conv-manual',
      botActive: true,
      botHandoffAt: null,
      activeBot: { id: 'bot-personal', name: 'Sales' },
    });
  });

  it('enableGlobalChatAi snapshots MANUAL-on chats before apply-all', async () => {
    const result = await enableGlobalChatAi({
      organizationId: 'org-1',
      whatsappNumberId: 'num-1',
      botId: 'bot-global',
    });

    expect(mocks.convFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          botAssignmentSource: 'MANUAL',
          botActive: true,
        }),
      })
    );
    expect(mocks.orgUpdate).toHaveBeenCalled();
    expect(result.remembered).toBe(1);
    expect(result.settings.manualSnapshot).toEqual({
      'conv-manual': { botId: 'bot-personal' },
    });
    expect(mocks.applyBotToAllChats).toHaveBeenCalledWith(
      expect.objectContaining({ includeManual: true, botId: 'bot-global' })
    );
  });

  it('disableGlobalChatAi restores remembered MANUAL chats', async () => {
    mocks.orgFind.mockResolvedValue({
      settings: {
        chat: {
          byNumber: {
            'num-1': {
              aiEnabled: true,
              botId: 'bot-global',
              manualSnapshot: { 'conv-manual': { botId: 'bot-personal' } },
            },
          },
        },
      },
    });

    const result = await disableGlobalChatAi({
      organizationId: 'org-1',
      whatsappNumberId: 'num-1',
    });

    expect(mocks.disableNonManualChatsForNumber).toHaveBeenCalled();
    expect(mocks.convUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-manual', organizationId: 'org-1', whatsappNumberId: 'num-1' },
        data: expect.objectContaining({
          botActive: true,
          botAssignmentSource: 'MANUAL',
          activeBotId: 'bot-personal',
        }),
      })
    );
    expect(result.restored).toBe(1);
    expect(result.settings.aiEnabled).toBe(false);
  });
});
