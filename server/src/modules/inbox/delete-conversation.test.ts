import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../config/database';
import { cancelFlowDelayJob } from '../flows/pause-automation';
import { deleteConversationKeepingHistory } from './delete-conversation';

const tx = {
  call: { updateMany: vi.fn() },
  ticket: { updateMany: vi.fn() },
  order: { updateMany: vi.fn() },
  conversation: { delete: vi.fn() },
};

vi.mock('../../config/database', () => ({
  default: {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
  },
}));

vi.mock('../flows/pause-automation', () => ({
  cancelFlowDelayJob: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  tx.call.updateMany.mockResolvedValue({ count: 2 });
  tx.ticket.updateMany.mockResolvedValue({ count: 0 });
  tx.order.updateMany.mockResolvedValue({ count: 1 });
  tx.conversation.delete.mockResolvedValue({ id: 'conv-1' });
});

describe('deleteConversationKeepingHistory', () => {
  it('unlinks calls, tickets, and orders before deleting the conversation', async () => {
    await deleteConversationKeepingHistory('conv-1', 'org-1');

    expect(tx.call.updateMany).toHaveBeenCalledWith({
      where: { conversationId: 'conv-1', organizationId: 'org-1' },
      data: { conversationId: null },
    });
    expect(tx.ticket.updateMany).toHaveBeenCalledWith({
      where: { conversationId: 'conv-1', organizationId: 'org-1' },
      data: { conversationId: null },
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { conversationId: 'conv-1', organizationId: 'org-1' },
      data: { conversationId: null },
    });
    expect(tx.conversation.delete).toHaveBeenCalledWith({ where: { id: 'conv-1' } });
    expect(cancelFlowDelayJob).toHaveBeenCalledWith('conv-1');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
