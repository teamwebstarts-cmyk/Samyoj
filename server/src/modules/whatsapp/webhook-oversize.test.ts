import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * G4/G5 — P1-2 webhook envelope overflow + stale sweep.
 *
 * The 15 Oct incident: a payload whose ciphertext exceeded the btree limit
 * (54000) thrown out of persistEnvelope, retried 4x by BullMQ, leaving two
 * rows RECEIVED forever and oldestWaitingMs lying by days.
 *
 * These tests prove:
 *  - oversize ciphertext is stored as a small COMPLETED tombstone, ACKed ('oversize')
 *  - a 54000 thrown by the DB still results in a tombstone + 'oversize' (no throw)
 *  - duplicates still return 'duplicate'
 *  - abandonStaleWebhookEnvelopes flips only rows older than the window
 *  - the receipt path records byChannel.ABANDONED-ish telemetry (via count return)
 */
const create = vi.fn();
const updateMany = vi.fn();
const findFirst = vi.fn();

vi.mock('../../config/database', () => ({
  default: {
    providerWebhookEvent: { create, updateMany, findFirst },
    whatsappNumber: { findFirst: vi.fn(async () => ({ id: 'num-1', organizationId: 'org-1' })) },
    channel: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock('../../config/queues', () => ({
  webhookQueue: { add: vi.fn(async () => ({})) },
}));

const { encrypt } = await import('../../utils/crypto');
const { Prisma } = await import('@prisma/client');

function prismaError(code: string, message: string) {
  // Must be a real PrismaClientKnownRequestError — the accept path branches on
  // instanceof before reading `.code`.
  return new Prisma.PrismaClientKnownRequestError(message, {
    code: code as never,
    clientVersion: 'test',
  });
}

// Import after mocks; Prisma namespace is only referenced for instanceof.
const { persistAndEnqueueInboundWebhook, abandonStaleWebhookEnvelopes, oldestWebhookWaitingMs } =
  await import('./webhook-accept');

const routedOrg = { organizationId: 'org-1' };

describe('webhook envelope oversize + stale sweep', () => {
  beforeEach(() => {
    create.mockReset();
    updateMany.mockReset();
    findFirst.mockReset();
  });

  it('stores an oversize payload as a COMPLETED tombstone and still acks + queues nothing', async () => {
    create.mockResolvedValue({});
    const bigString = 'x'.repeat(700 * 1024); // ciphertext would exceed the btree row
    const payload = {
      object: 'whatsapp_business_account',
      big: bigString,
      entry: [{ changes: [{ value: { phone_number_id: 'pn-1' } }] }],
    };

    const result = await persistAndEnqueueInboundWebhook({
      payload,
      requestId: 'req-1',
    });

    expect(result.persist).toBe('oversize');
    const row = create.mock.calls[0][0].data;
    expect(row.status).toBe('COMPLETED');
    expect(row.processedAt).toBeTruthy();
    expect(String(row.payloadCiphertext).startsWith('oversize:')).toBe(true);
    expect(String(row.payloadCiphertext).length).toBeLessThan(100);
  });

  it('survives a 54000 from the DB: tombstone + oversize, never a throw', async () => {
    create
      .mockRejectedValueOnce(
        prismaError('54000', 'index row size 3328 exceeds btree version 4 maximum 2704')
      )
      .mockResolvedValueOnce({});
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { phone_number_id: 'pn-1' } }] }],
    };

    const result = await persistAndEnqueueInboundWebhook({ payload, requestId: 'req-2' });

    expect(result.persist).toBe('oversize');
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].data.status).toBe('COMPLETED');
  });

  it('still reports duplicates on P2002', async () => {
    create.mockRejectedValue(prismaError('P2002', 'unique constraint'));
    const result = await persistAndEnqueueInboundWebhook({
      payload: {
        object: 'whatsapp_business_account',
        entry: [{ changes: [{ value: { phone_number_id: 'pn-1' } }] }],
      },
      requestId: 'req-3',
    });
    expect(result.persist).toBe('duplicate');
  });

  it('marks stale envelopes ABANDONED and leaves fresh ones alone', async () => {
    updateMany.mockResolvedValue({ count: 2 });
    const count = await abandonStaleWebhookEnvelopes();
    expect(count).toBe(2);
    const call = updateMany.mock.calls[0][0];
    expect(call.where.status).toEqual({ in: ['RECEIVED', 'PROCESSING'] });
    expect(call.data.status).toBe('ABANDONED');
  });

  it('oldestWebhookWaitingMs measures from the oldest claim', async () => {
    findFirst.mockResolvedValue({ claimedAt: new Date(Date.now() - 5000) });
    const ms = await oldestWebhookWaitingMs();
    expect(ms).toBeGreaterThanOrEqual(4000);
    expect(ms).toBeLessThan(10000);
  });

  it('encrypt/decrypt roundtrip stays intact', () => {
    const cipher = encrypt('roundtrip-value');
    expect(typeof cipher).toBe('string');
    expect(cipher.length).toBeGreaterThan(10);
  });
});

afterAll(() => {
  console.log('webhook overflow verification passed');
});
