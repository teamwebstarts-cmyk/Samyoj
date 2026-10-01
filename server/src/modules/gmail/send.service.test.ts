import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateMany = vi.hoisted(() => vi.fn());
const add = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock('../../config/database', () => ({
  default: {
    emailSend: { updateMany },
    emailAttachment: {
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}));

vi.mock('../../config/queues', () => ({
  gmailSendQueue: { add },
}));

vi.mock('../../errors', () => ({
  logError,
}));

vi.mock('../media/storage-adapter', () => ({
  deleteMediaObject: vi.fn(),
  fetchMediaBuffer: vi.fn(),
}));

import { gmailSendJobId } from './constants';
import { claimGmailSend, enqueueGmailSend } from './send.service';

describe('gmailSendJobId', () => {
  it('uses a hyphen and never a colon', () => {
    const id = gmailSendJobId('27b7daa5-6cff-4143-84e4-a82598871bbc');
    expect(id).toBe('gmail-send-27b7daa5-6cff-4143-84e4-a82598871bbc');
    expect(id.includes(':')).toBe(false);
  });

  it('rejects a colon in the send id', () => {
    expect(() => gmailSendJobId('gmail-send:oops')).toThrow(/colon/);
  });
});

describe('Gmail send lease', () => {
  beforeEach(() => updateMany.mockReset());

  it('atomically changes a queued row to SENDING with a lease', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const now = new Date('2026-09-30T00:00:00.000Z');

    const token = await claimGmailSend('send-1', now);

    expect(token).toEqual(expect.any(String));
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'send-1',
        status: 'QUEUED',
        whatsappNumberId: { not: null },
        whatsappNumber: { isActive: true },
      },
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

describe('enqueueGmailSend', () => {
  beforeEach(() => {
    updateMany.mockReset();
    add.mockReset();
    logError.mockReset();
  });

  it('marks the row FAILED when BullMQ rejects the job id', async () => {
    add.mockRejectedValue(new Error('Custom Id cannot contain :'));
    updateMany.mockResolvedValue({ count: 1 });

    await expect(enqueueGmailSend('send-1', { source: 'api', organizationId: 'org-1' })).rejects.toThrow(
      /Custom Id cannot contain/,
    );

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'send-1', status: { in: ['QUEUED', 'SENDING'] } }),
        data: expect.objectContaining({
          status: 'FAILED',
          errorCode: 'GMAIL_ENQUEUE_FAILED',
          statusReason: 'Email could not be queued. Try again.',
        }),
      }),
    );
    expect(logError).toHaveBeenCalled();
  });

  it('adds a hyphen job id', async () => {
    add.mockResolvedValue({ id: 'job-1' });
    await enqueueGmailSend('send-1');
    expect(add).toHaveBeenCalledWith(
      'send-email',
      { emailSendId: 'send-1' },
      { jobId: 'gmail-send-send-1' },
    );
  });
});
