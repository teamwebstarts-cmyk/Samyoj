import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateMany = vi.hoisted(() => vi.fn());

vi.mock('../../config/database', () => ({
  default: {
    emailSend: { updateMany },
  },
}));

import { claimGmailSend } from './send.service';

describe('Gmail send lease', () => {
  beforeEach(() => updateMany.mockReset());

  it('atomically changes a queued row to SENDING with a lease', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const now = new Date('2026-09-30T00:00:00.000Z');

    const token = await claimGmailSend('send-1', now);

    expect(token).toEqual(expect.any(String));
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'send-1', status: 'QUEUED' },
      data: expect.objectContaining({
        status: 'SENDING',
        attempts: { increment: 1 },
        sendingLeaseToken: token,
        sendingLeaseExpiresAt: new Date('2026-09-30T00:15:00.000Z'),
      }),
    });
  });

  it('does not claim a row already claimed by another worker', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(claimGmailSend('send-1')).resolves.toBeNull();
  });
});
