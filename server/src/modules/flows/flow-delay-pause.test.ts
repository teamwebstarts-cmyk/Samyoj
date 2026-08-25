import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    flow: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock('../whatsapp/context', () => ({
  getActiveWhatsappNumberCredentials: vi.fn().mockResolvedValue({}),
}));

vi.mock('./lock', () => ({
  withConversationLock: vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('./pause-automation', () => ({
  cancelFlowDelayJob: vi.fn(),
  clearFlowWaitState: vi.fn(),
}));

vi.mock('../messages/send.service', () => ({
  deliverOutboundMessage: vi.fn(),
  isCswClosedError: () => false,
}));

import prisma from '../../config/database';
import { resumeFlowAfterDelay } from './engine';
import { clearFlowWaitState } from './pause-automation';
import { deliverOutboundMessage } from '../messages/send.service';

const flowFind = vi.mocked(prisma.flow.findFirst);
const conversationFind = vi.mocked(prisma.conversation.findFirst);
const clearWait = vi.mocked(clearFlowWaitState);
const deliver = vi.mocked(deliverOutboundMessage);

const job = {
  conversationId: 'conv-1',
  organizationId: 'org-1',
  flowId: 'flow-1',
  nextNodeId: 'step-2',
  contactId: 'contact-1',
  whatsappNumberId: 'wa-1',
};

describe('resumeFlowAfterDelay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flowFind.mockResolvedValue({
      id: 'flow-1',
      nodes: [
        { id: 'step-1', type: 'delay', next: 'step-2' },
        { id: 'step-2', type: 'message', text: 'After delay', next: 'end' },
        { id: 'end', type: 'end' },
      ],
    } as never);
  });

  it('clears waiting state and does not send when Inbox paused the bot before the delay fires', async () => {
    conversationFind.mockResolvedValue({
      id: 'conv-1',
      organizationId: 'org-1',
      whatsappNumberId: 'wa-1',
      contactId: 'contact-1',
      botActive: false,
      botHandoffAt: null,
      contact: { phone: '+919876543210', name: 'Rahul', tags: [] },
      botState: {
        flowId: 'flow-1',
        currentNodeId: 'step-1',
        waitingFor: 'delay',
      },
    } as never);

    await resumeFlowAfterDelay(job);

    expect(clearWait).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ organizationId: 'org-1', whatsappNumberId: 'wa-1' }),
    );
    expect(deliver).not.toHaveBeenCalled();
  });
});
