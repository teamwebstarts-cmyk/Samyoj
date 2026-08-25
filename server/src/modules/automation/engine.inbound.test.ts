import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    conversation: { findFirst: vi.fn() },
    contact: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    automation: { findMany: vi.fn() },
    message: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    automationLog: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('../flows/engine', () => ({
  handleInboundFlow: vi.fn(),
}));

vi.mock('../../config/queues', () => ({
  flowQueue: { getJob: vi.fn(), add: vi.fn() },
  automationQueue: { getJob: vi.fn(), add: vi.fn() },
}));

vi.mock('../ai/chatbot.service', () => ({
  logAutomationRun: vi.fn(),
  performHandoff: vi.fn(),
  generateBotReply: vi.fn(),
}));

vi.mock('../ai/bot.service', () => ({
  hasEnabledBots: vi.fn(),
}));

vi.mock('../ai/lock', () => ({
  withAiBotConversationLock: vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('../messages/send.service', () => ({
  deliverOutboundMessage: vi.fn(),
  isCswClosedError: () => false,
}));

vi.mock('../whatsapp/meta.service', () => ({
  MetaWhatsAppService: {
    decryptToken: vi.fn(),
    sendTypingIndicator: vi.fn(),
  },
}));

vi.mock('../settings/business-hours', () => ({
  getOrgBusinessHours: vi.fn(),
  isWithinBusinessHours: vi.fn(() => true),
}));

const resolveChatAiEffectivelyOnMock = vi.fn();
const syncConversationChatAiFromGlobalMock = vi.fn();

vi.mock('../chat/chat-ai-live', () => ({
  resolveChatAiEffectivelyOn: (...args: unknown[]) => resolveChatAiEffectivelyOnMock(...args),
  syncConversationChatAiFromGlobal: (...args: unknown[]) =>
    syncConversationChatAiFromGlobalMock(...args),
}));

import prisma from '../../config/database';
import { flowQueue, automationQueue } from '../../config/queues';
import { logAutomationRun } from '../ai/chatbot.service';
import { hasEnabledBots } from '../ai/bot.service';
import { handleInboundFlow } from '../flows/engine';
import { FLOW_LOCK_BUSY } from '../flows/inbound-wait';
import { handleInboundAutomations, isUnremovableQueueState, queueAiBotProcessing } from './engine';

const conversationMock = vi.mocked(prisma.conversation.findFirst);
const contactMock = vi.mocked(prisma.contact.findFirst);
const automationMock = vi.mocked(prisma.automation.findMany);
const logFindMock = vi.mocked(prisma.automationLog.findFirst);
const flowHandled = vi.mocked(handleInboundFlow);
const flowQueueAdd = vi.mocked(flowQueue.add);
const flowQueueGetJob = vi.mocked(flowQueue.getJob);
const automationQueueAdd = vi.mocked(automationQueue.add);
const logRun = vi.mocked(logAutomationRun);
const botsEnabled = vi.mocked(hasEnabledBots);

const payload = {
  organizationId: 'org-1',
  conversationId: 'conv-1',
  contactId: 'contact-1',
  messageId: 'msg-1',
  contactPhone: '919999999999',
  whatsappNumberId: 'wa-1',
  content: 'price please',
  isNewConversation: false,
};

describe('handleInboundAutomations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conversationMock.mockResolvedValue({
      id: 'conv-1',
      botActive: true,
      whatsappNumberId: 'wa-1',
      botHandoffAt: null,
    } as never);
    syncConversationChatAiFromGlobalMock.mockImplementation(async (_org, conv) => conv);
    resolveChatAiEffectivelyOnMock.mockImplementation(async (_org, conv) => ({
      live: conv.botActive === true,
      globalAiEnabled: false,
      botId: null,
    }));
    contactMock.mockResolvedValue({ optedIn: true } as never);
    automationMock.mockResolvedValue([]);
    logFindMock.mockResolvedValue(null);
    flowQueueGetJob.mockResolvedValue(undefined);
    flowQueueAdd.mockResolvedValue({} as never);
    automationQueueAdd.mockResolvedValue({} as never);
    botsEnabled.mockResolvedValue(true);
    vi.mocked(automationQueue.getJob).mockResolvedValue(undefined);
    vi.mocked(prisma.message.findUnique).mockResolvedValue({ metadata: {} } as never);
    vi.mocked(prisma.message.update).mockResolvedValue({} as never);
  });

  it('skips flow, static, and AI when Inbox paused the bot', async () => {
    conversationMock.mockResolvedValue({
      id: 'conv-1',
      botActive: false,
      whatsappNumberId: 'wa-1',
      botHandoffAt: null,
    } as never);
    resolveChatAiEffectivelyOnMock.mockResolvedValue({
      live: false,
      globalAiEnabled: false,
      botId: null,
    });

    await handleInboundAutomations(payload);

    expect(flowHandled).not.toHaveBeenCalled();
    expect(automationMock).not.toHaveBeenCalled();
    expect(automationQueueAdd).not.toHaveBeenCalled();
    expect(logRun).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        action: 'bot_paused',
        status: 'skipped',
      })
    );
  });

  it('requeues on FLOW_LOCK_BUSY instead of falling through to AI', async () => {
    flowHandled.mockResolvedValue(FLOW_LOCK_BUSY);

    await handleInboundAutomations(payload);

    expect(flowQueueAdd).toHaveBeenCalledWith(
      'retry-inbound',
      expect.objectContaining({ conversationId: 'conv-1', lockRetry: 1 }),
      expect.objectContaining({ jobId: 'flow-retry-conv-1-msg-1' })
    );
    expect(automationMock).not.toHaveBeenCalled();
    expect(automationQueueAdd).not.toHaveBeenCalled();
  });

  it('does not run static auto-replies when a flow handled the inbound', async () => {
    flowHandled.mockResolvedValue(true);

    await handleInboundAutomations(payload);

    expect(automationMock).not.toHaveBeenCalled();
    expect(automationQueueAdd).not.toHaveBeenCalled();
  });

  it('does not run static auto-replies when an agent owns a non-open chat', async () => {
    flowHandled.mockResolvedValue(false);
    conversationMock.mockResolvedValue({
      id: 'conv-1',
      botActive: true,
      whatsappNumberId: 'wa-1',
      botHandoffAt: null,
      assignedAgentId: 'agent-1',
      status: 'PENDING',
    } as never);

    await handleInboundAutomations(payload);

    expect(automationMock).not.toHaveBeenCalled();
    expect(automationQueueAdd).not.toHaveBeenCalled();
    expect(logRun).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        action: 'agent_assigned',
        status: 'skipped',
      })
    );
  });

  it('still queues AI when global chat is on even if personal botActive is false', async () => {
    flowHandled.mockResolvedValue(false);
    conversationMock.mockResolvedValue({
      id: 'conv-1',
      botActive: false,
      whatsappNumberId: 'wa-1',
      botHandoffAt: null,
      assignedAgentId: null,
      status: 'OPEN',
    } as never);
    syncConversationChatAiFromGlobalMock.mockImplementation(async (_org, conv) => ({
      ...conv,
      botActive: true,
      botAssignmentSource: 'APPLIED',
    }));
    resolveChatAiEffectivelyOnMock.mockResolvedValue({
      live: true,
      globalAiEnabled: true,
      botId: 'bot-1',
    });

    await handleInboundAutomations(payload);

    expect(automationQueueAdd).toHaveBeenCalledWith(
      'ai-chatbot',
      expect.objectContaining({ conversationId: 'conv-1' }),
      expect.objectContaining({ jobId: 'ai-bot-conv-1' })
    );
  });

  it('still queues the AI bot when the contact opted out of marketing', async () => {
    flowHandled.mockResolvedValue(false);
    conversationMock
      .mockResolvedValueOnce({ botActive: true } as never)
      .mockResolvedValueOnce({
        botActive: true,
        botHandoffAt: null,
        assignedAgentId: null,
        status: 'OPEN',
      } as never);
    contactMock.mockResolvedValue({ optedIn: false } as never);

    await handleInboundAutomations(payload);

    expect(automationMock).toHaveBeenCalled();
    expect(automationQueueAdd).toHaveBeenCalledWith(
      'ai-chatbot',
      expect.objectContaining({ conversationId: 'conv-1' }),
      expect.objectContaining({ jobId: 'ai-bot-conv-1' })
    );
  });

  it('queues the AI bot when no flow and no static rule match', async () => {
    flowHandled.mockResolvedValue(false);
    conversationMock
      .mockResolvedValueOnce({ botActive: true } as never)
      .mockResolvedValueOnce({
        botActive: true,
        botHandoffAt: null,
        assignedAgentId: null,
        status: 'OPEN',
      } as never);

    await handleInboundAutomations(payload);

    expect(automationQueueAdd).toHaveBeenCalledWith(
      'ai-chatbot',
      expect.objectContaining({ conversationId: 'conv-1' }),
      expect.objectContaining({ jobId: 'ai-bot-conv-1' })
    );
  });

  it('still queues AI when botActive is true even if a stale botHandoffAt remains', async () => {
    flowHandled.mockResolvedValue(false);
    conversationMock
      .mockResolvedValueOnce({ botActive: true } as never)
      .mockResolvedValueOnce({
        botActive: true,
        botHandoffAt: new Date('2026-08-08T18:24:28.068Z'),
        assignedAgentId: null,
        status: 'OPEN',
      } as never);

    await handleInboundAutomations(payload);

    expect(automationQueueAdd).toHaveBeenCalledWith(
      'ai-chatbot',
      expect.objectContaining({ conversationId: 'conv-1' }),
      expect.objectContaining({ jobId: 'ai-bot-conv-1' })
    );
  });
});

describe('queueAiBotProcessing debounce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conversationMock.mockResolvedValue({
      id: 'conv-1',
      botActive: true,
      whatsappNumberId: 'wa-1',
      botHandoffAt: null,
      assignedAgentId: null,
      status: 'OPEN',
    } as never);
    syncConversationChatAiFromGlobalMock.mockImplementation(async (_org, conv) => conv);
    resolveChatAiEffectivelyOnMock.mockResolvedValue({
      live: true,
      globalAiEnabled: false,
      botId: null,
    });
    botsEnabled.mockResolvedValue(true);
    automationQueueAdd.mockResolvedValue({} as never);
  });
  it('treats an active BullMQ job as unremovable', () => {
    expect(isUnremovableQueueState('active')).toBe(true);
    expect(isUnremovableQueueState('delayed')).toBe(false);
  });

  it('queues a follow-up instead of throwing when the debounce job is locked', async () => {
    conversationMock.mockResolvedValue({
      id: 'conv-1',
      botActive: true,
      whatsappNumberId: 'wa-1',
      botHandoffAt: null,
      assignedAgentId: null,
      status: 'OPEN',
    } as never);
    botsEnabled.mockResolvedValue(true);
    vi.mocked(automationQueue.getJob).mockResolvedValue({
      getState: vi.fn().mockResolvedValue('active'),
      remove: vi.fn(),
    } as never);

    await queueAiBotProcessing(payload);

    expect(automationQueueAdd).toHaveBeenCalledWith(
      'ai-chatbot',
      expect.objectContaining({ messageId: 'msg-1' }),
      expect.objectContaining({ jobId: 'ai-bot-conv-1-msg-1' })
    );
  });
});
