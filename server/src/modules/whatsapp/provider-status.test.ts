import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../config/database';
import {
  handleOutboundStatusWebhook,
  persistUnmatchedProviderStatus,
  shouldApplyProviderStatus,
  unmatchedStatusEventAt,
} from './provider-status';

vi.mock('../../config/database', () => ({
  default: {
    unmatchedProviderStatus: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    message: { findFirst: vi.fn(), updateMany: vi.fn() },
    whatsappNumber: { findFirst: vi.fn() },
    campaignRecipient: { findUnique: vi.fn() },
  },
}));

vi.mock('../../realtime', () => ({
  emitToOrg: vi.fn(),
}));

vi.mock('../campaigns/service', () => ({
  syncCampaignRecipientFromWebhook: vi.fn(),
}));

const unmatchedMock = vi.mocked(prisma.unmatchedProviderStatus);
const messageMock = vi.mocked(prisma.message);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('shouldApplyProviderStatus', () => {
  it('does not regress delivered/read to sent', () => {
    expect(
      shouldApplyProviderStatus({
        currentStatus: 'READ',
        nextStatus: 'SENT',
        existingStatusAt: new Date('2026-08-14T12:00:01.000Z'),
        eventAt: new Date('2026-08-14T12:00:00.000Z'),
      })
    ).toBe(false);
  });

  it('applies a later delivered tick over sent', () => {
    expect(
      shouldApplyProviderStatus({
        currentStatus: 'SENT',
        nextStatus: 'DELIVERED',
        existingStatusAt: new Date('2026-08-14T12:00:00.000Z'),
        eventAt: new Date('2026-08-14T12:00:02.000Z'),
      })
    ).toBe(true);
  });

  it('applies FAILED when Meta supplied an event time', () => {
    expect(
      shouldApplyProviderStatus({
        currentStatus: 'SENT',
        nextStatus: 'FAILED',
        existingStatusAt: new Date('2026-08-14T12:00:00.000Z'),
        eventAt: new Date('2026-08-14T12:00:03.000Z'),
      })
    ).toBe(true);
  });
});

describe('unmatchedStatusEventAt', () => {
  it('uses a stable sentinel when Meta omitted a timestamp', () => {
    expect(unmatchedStatusEventAt(undefined).toISOString()).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('persistUnmatchedProviderStatus', () => {
  it('stores an unmatched tick for later reconcile', async () => {
    unmatchedMock.create.mockResolvedValue({ id: 'u-1' } as never);
    const eventAt = new Date('2026-08-14T12:00:00.000Z');
    await persistUnmatchedProviderStatus({
      organizationId: 'org-1',
      whatsappNumberId: 'wa-1',
      metaMessageId: 'wamid.1',
      status: 'DELIVERED',
      eventAt,
      recipientPhone: '9198',
    });
    expect(unmatchedMock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        whatsappNumberId: 'wa-1',
        metaMessageId: 'wamid.1',
        status: 'DELIVERED',
        recipientPhone: '9198',
        eventAt,
      }),
    });
  });

  it('treats a duplicate unmatched row as success', async () => {
    unmatchedMock.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
      })
    );
    await expect(
      persistUnmatchedProviderStatus({
        organizationId: 'org-1',
        whatsappNumberId: 'wa-1',
        metaMessageId: 'wamid.1',
        status: 'SENT',
      })
    ).resolves.toBeUndefined();
  });
});

describe('handleOutboundStatusWebhook', () => {
  it('persists unmatched status when the local Meta id is not saved yet', async () => {
    messageMock.findFirst.mockResolvedValue(null);
    unmatchedMock.create.mockResolvedValue({ id: 'u-1' } as never);

    await handleOutboundStatusWebhook({
      organizationId: 'org-1',
      whatsappNumberId: 'wa-1',
      phoneNumberId: 'phone-1',
      metaMessageId: 'wamid.late',
      statusValue: 'DELIVERED',
      statusTimestamp: new Date('2026-08-14T12:00:00.000Z'),
      status: { recipient_id: '9198' },
    });

    expect(unmatchedMock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metaMessageId: 'wamid.late',
        status: 'DELIVERED',
        recipientPhone: '9198',
      }),
    });
    expect(messageMock.updateMany).not.toHaveBeenCalled();
  });
});
