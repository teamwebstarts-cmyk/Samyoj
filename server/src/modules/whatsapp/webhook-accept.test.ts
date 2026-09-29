import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../config/database';
import { webhookQueue } from '../../config/queues';
import {
  collectWebhookPhoneNumberIds,
  inboundWebhookEnvelopeKey,
  inboundWebhookJobId,
  persistAndEnqueueInboundWebhook,
  replayInboundWebhookEnvelope,
} from './webhook-accept';

vi.mock('../../config/database', () => ({
  default: {
    whatsappNumber: { findFirst: vi.fn() },
    channel: { findMany: vi.fn() },
    providerWebhookEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../../config/queues', () => ({
  webhookQueue: { add: vi.fn() },
}));

vi.mock('../../utils/crypto', () => ({
  encrypt: (text: string) => `enc:${text}`,
  decrypt: (text: string) => text.replace(/^enc:/, ''),
}));

const numbers = vi.mocked(prisma.whatsappNumber);
const channels = vi.mocked(prisma.channel);
const events = vi.mocked(prisma.providerWebhookEvent);
const queueAdd = vi.mocked(webhookQueue.add);

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.0.0',
  });
}

const payload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      changes: [
        {
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'phone-1' },
            messages: [{ id: 'wamid.1', from: '9198', type: 'text' }],
          },
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  numbers.findFirst.mockResolvedValue({ id: 'wa-1', organizationId: 'org-1' } as never);
  channels.findMany.mockResolvedValue([] as never);
  events.create.mockResolvedValue({ id: 'evt-1' } as never);
  queueAdd.mockResolvedValue({ id: 'job-1' } as never);
});

describe('inbound webhook persist-then-enqueue', () => {
  it('collects every phone_number_id in the payload', () => {
    expect(
      collectWebhookPhoneNumberIds({
        entry: [
          { changes: [{ value: { metadata: { phone_number_id: 'phone-1' } } }] },
          { changes: [{ value: { metadata: { phone_number_id: 'phone-2' } } }] },
        ],
      })
    ).toEqual(['phone-1', 'phone-2']);
  });

  it('uses a BullMQ-safe envelope job id', () => {
    const eventKey = inboundWebhookEnvelopeKey(payload);
    expect(eventKey.startsWith('envelope_')).toBe(true);
    expect(inboundWebhookJobId(eventKey)).toBe(eventKey);
  });

  it('resolves Page/Instagram envelopes to their active channel organization', async () => {
    numbers.findFirst.mockResolvedValue(null);
    channels.findMany.mockResolvedValue([{ organizationId: 'org-ig' }] as never);
    const instagramPayload = {
      object: 'instagram',
      entry: [{ id: '17841400000000001', messaging: [{ sender: { id: 'customer-1' } }] }],
    };

    const result = await persistAndEnqueueInboundWebhook({
      payload: instagramPayload,
      requestId: 'ig_1',
    });

    expect(result.organizationId).toBe('org-ig');
    expect(events.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'org-ig', requestId: 'ig_1' }),
    });
  });

  it('persists the envelope before the queue add, and the caller acks only after both', async () => {
    const order: string[] = [];
    events.create.mockImplementation(async () => {
      order.push('persist');
      return { id: 'evt-1' } as never;
    });
    queueAdd.mockImplementation(async () => {
      expect(order).toEqual(['persist']);
      order.push('queue');
      return { id: 'job-1' } as never;
    });

    const result = await persistAndEnqueueInboundWebhook({ payload, requestId: 'wh_1' });
    order.push('ack');

    expect(order).toEqual(['persist', 'queue', 'ack']);
    expect(result.persist).toBe('created');
    expect(result.queue).toBe('queued');
    expect(events.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        eventKey: inboundWebhookEnvelopeKey(payload),
        status: 'RECEIVED',
        payloadCiphertext: expect.stringMatching(/^enc:/),
        requestId: 'wh_1',
        phoneNumberId: 'phone-1',
      }),
    });
    expect(queueAdd).toHaveBeenCalledWith(
      'process-webhook',
      expect.objectContaining({
        eventKey: inboundWebhookEnvelopeKey(payload),
        organizationId: 'org-1',
      }),
      expect.objectContaining({ jobId: inboundWebhookEnvelopeKey(payload), attempts: 4 })
    );
  });

  it('does not enqueue when persist throws, so Meta can retry', async () => {
    events.create.mockRejectedValue(new Error('db down'));
    await expect(persistAndEnqueueInboundWebhook({ payload, requestId: 'wh_1' })).rejects.toThrow(
      'db down'
    );
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it('replays from the persisted row after a crash between persist and queue', async () => {
    events.create
      .mockResolvedValueOnce({ id: 'evt-1' } as never)
      .mockRejectedValueOnce(uniqueViolation());
    queueAdd.mockRejectedValueOnce(new Error('redis down')).mockResolvedValue({ id: 'job-1' } as never);

    await expect(persistAndEnqueueInboundWebhook({ payload, requestId: 'wh_1' })).rejects.toThrow(
      'redis down'
    );
    expect(events.create).toHaveBeenCalledTimes(1);

    const retried = await persistAndEnqueueInboundWebhook({ payload, requestId: 'wh_2' });
    expect(retried.persist).toBe('duplicate');
    expect(retried.queue).toBe('queued');
    expect(queueAdd).toHaveBeenCalledTimes(2);
    expect(vi.mocked(queueAdd).mock.calls[0][2]).toMatchObject({
      jobId: inboundWebhookEnvelopeKey(payload),
    });
    expect(vi.mocked(queueAdd).mock.calls[1][2]).toMatchObject({
      jobId: inboundWebhookEnvelopeKey(payload),
    });
  });

  it('treats N duplicate payloads as one envelope job', async () => {
    events.create.mockRejectedValue(uniqueViolation());
    queueAdd.mockRejectedValue(new Error('Job envelope_abc already exists'));

    for (let i = 0; i < 25; i += 1) {
      const result = await persistAndEnqueueInboundWebhook({ payload, requestId: `wh_${i}` });
      expect(result.persist).toBe('duplicate');
      expect(result.queue).toBe('duplicate');
    }
    expect(queueAdd).toHaveBeenCalledTimes(25);
    const jobIds = vi.mocked(queueAdd).mock.calls.map((call) => (call[2] as { jobId: string }).jobId);
    expect(new Set(jobIds).size).toBe(1);
  });

  it('replays an encrypted envelope for operators', async () => {
    events.findUnique.mockResolvedValue({
      payloadCiphertext: `enc:${JSON.stringify(payload)}`,
      requestId: 'wh_1',
    } as never);

    const replayed = await replayInboundWebhookEnvelope({
      organizationId: 'org-1',
      eventKey: inboundWebhookEnvelopeKey(payload),
      actorUserId: 'user-1',
    });
    expect(replayed.jobId).toMatch(/_replay_/);
    expect(queueAdd).toHaveBeenCalledWith(
      'process-webhook',
      expect.objectContaining({ payload, organizationId: 'org-1' }),
      expect.objectContaining({ jobId: replayed.jobId })
    );
  });
});
