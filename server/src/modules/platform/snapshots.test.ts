import { describe, expect, it, vi } from 'vitest';
import {
  backfillOrgHealthSnapshots,
  cleanupPlatformTelemetry,
  computeOrgHealthSnapshot,
  META_ERROR_RETENTION_DAYS,
  PRODUCT_EVENT_RETENTION_DAYS,
  SNAPSHOT_RETENTION_DAYS,
} from './snapshots';

function healthySnapshotDatabase() {
  return {
    organization: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'org-1',
        plan: 'growth',
        planExpiresAt: new Date('2026-12-01T00:00:00.000Z'),
        subscriptionStatus: 'active',
      }),
      findMany: vi.fn().mockResolvedValue([{ id: 'org-1' }]),
    },
    whatsappNumber: {
      findMany: vi.fn().mockResolvedValue([{ id: 'active-1', qualityRating: 'GREEN' }]),
    },
    organizationUser: {
      aggregate: vi.fn().mockResolvedValue({
        _max: { lastActiveAt: new Date('2026-08-16T00:00:00.000Z') },
      }),
    },
    contact: { count: vi.fn().mockResolvedValue(3) },
    conversation: { count: vi.fn().mockResolvedValue(2) },
    message: {
      count: vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(2),
      aggregate: vi.fn().mockResolvedValue({
        _max: { createdAt: new Date('2026-08-16T10:00:00.000Z') },
      }),
    },
    campaign: { count: vi.fn().mockResolvedValue(1) },
    call: { count: vi.fn().mockResolvedValue(1) },
    aiUsageLog: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { totalTokens: 42 } }),
      findFirst: vi.fn().mockResolvedValue({
        createdAt: new Date('2026-08-16T09:00:00.000Z'),
      }),
    },
    paymentOrder: { count: vi.fn().mockResolvedValue(0) },
    orgHealthSnapshot: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    productEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    metaErrorStat: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    platformAuditLog: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    outreachLog: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    platformSession: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
}

describe('platform snapshot computation', () => {
  it('scopes all number-owned counts to active numbers', async () => {
    const database = healthySnapshotDatabase();
    const snapshot = await computeOrgHealthSnapshot(
      'org-1',
      new Date('2026-08-17T12:00:00.000Z'),
      database as never
    );

    expect(snapshot).toEqual(
      expect.objectContaining({
        stage: 'LIVE',
        activeNumberCount: 1,
        contactCount: 3,
        outboundMessageCount: 4,
        inboundMessageCount: 2,
        aiTokensMonth: 42,
      })
    );
    expect(database.contact.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', whatsappNumberId: { in: ['active-1'] } },
    });
    expect(database.conversation.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', whatsappNumberId: { in: ['active-1'] } },
    });
    for (const call of database.message.count.mock.calls) {
      expect(call[0].where.conversation.whatsappNumberId).toEqual({ in: ['active-1'] });
    }
    expect(database.aiUsageLog.aggregate.mock.calls[0][0].where.whatsappNumberId).toEqual({
      in: ['active-1'],
    });
  });

  it('uses a same-day upsert key when backfill is repeated', async () => {
    const database = healthySnapshotDatabase();
    const now = new Date('2026-08-17T12:00:00.000Z');

    await backfillOrgHealthSnapshots(now, database as never);
    database.message.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    await backfillOrgHealthSnapshots(now, database as never);

    expect(database.orgHealthSnapshot.upsert).toHaveBeenCalledTimes(2);
    const firstKey =
      database.orgHealthSnapshot.upsert.mock.calls[0][0].where.organizationId_capturedAt;
    const secondKey =
      database.orgHealthSnapshot.upsert.mock.calls[1][0].where.organizationId_capturedAt;
    expect(secondKey).toEqual(firstKey);
  });
});

describe('platform snapshot retention', () => {
  it('deletes telemetry older than the retention window', async () => {
    const now = new Date('2026-08-17T12:00:00.000Z');
    const database = {
      productEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      orgHealthSnapshot: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      metaErrorStat: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
    };

    const result = await cleanupPlatformTelemetry(now, database as never);
    expect(result).toEqual({
      productEventsDeleted: 2,
      snapshotsDeleted: 1,
      metaErrorsDeleted: 3,
    });
    expect(database.productEvent.deleteMany.mock.calls[0][0].where.occurredAt.lt).toEqual(
      new Date(now.getTime() - PRODUCT_EVENT_RETENTION_DAYS * 86_400_000)
    );
    expect(database.orgHealthSnapshot.deleteMany.mock.calls[0][0].where.capturedAt.lt).toEqual(
      new Date(now.getTime() - SNAPSHOT_RETENTION_DAYS * 86_400_000)
    );
    expect(database.metaErrorStat.deleteMany.mock.calls[0][0].where.lastAt.lt).toEqual(
      new Date(now.getTime() - META_ERROR_RETENTION_DAYS * 86_400_000)
    );
  });
});
