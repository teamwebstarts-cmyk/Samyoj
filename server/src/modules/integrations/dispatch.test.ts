import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    webhookEndpoint: { findMany: vi.fn() },
    webhookDelivery: { create: vi.fn() },
  },
}));

vi.mock('../../config/queues', () => ({
  webhookDispatchQueue: { add: vi.fn() },
}));

vi.mock('../../utils/logger', () => ({
  createModuleLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../utils/safe-webhook-url', () => ({
  fetchPinnedWebhook: vi.fn(),
}));

import prisma from '../../config/database';
import { webhookDispatchQueue } from '../../config/queues';
import { dispatchOrgWebhook } from './dispatch';

describe('dispatchOrgWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not enqueue a second delivery for the same message event', async () => {
    vi.mocked(prisma.webhookEndpoint.findMany).mockResolvedValue([
      { id: 'ep-1', organizationId: 'org-1', enabled: true, events: ['message.received'] },
    ] as never);
    vi.mocked(prisma.webhookDelivery.create)
      .mockResolvedValueOnce({ id: 'd1' } as never)
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.0.0',
        })
      );

    await dispatchOrgWebhook('org-1', 'message.received', { messageId: 'msg-1' });
    await dispatchOrgWebhook('org-1', 'message.received', { messageId: 'msg-1' });

    expect(webhookDispatchQueue.add).toHaveBeenCalledTimes(1);
  });
});
