import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../config/database';
import {
  claimProviderWebhookEvent,
  completeProviderWebhookEvent,
  PROVIDER_WEBHOOK_CLAIM_STALE_MS,
  releaseProviderWebhookEvent,
} from './webhook-dispatcher';

vi.mock('../../config/database', () => ({
  default: {
    whatsappNumber: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    providerWebhookEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const events = vi.mocked(prisma.providerWebhookEvent);

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.0.0',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('provider webhook claim lifecycle', () => {
  it('claims a new event as PROCESSING', async () => {
    events.create.mockResolvedValue({ id: 'evt-1' } as never);
    await expect(claimProviderWebhookEvent('org-1', 'key-1', 'account_alerts')).resolves.toBe(true);
    expect(events.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        eventKey: 'key-1',
        field: 'account_alerts',
        status: 'PROCESSING',
      }),
    });
  });

  it('skips a completed claim so Meta retries stay idempotent', async () => {
    events.create.mockRejectedValue(uniqueViolation());
    events.findUnique.mockResolvedValue({
      id: 'evt-1',
      status: 'COMPLETED',
      claimedAt: new Date(),
    } as never);
    await expect(claimProviderWebhookEvent('org-1', 'key-1', 'account_alerts')).resolves.toBe(false);
  });

  it('skips an in-flight PROCESSING claim', async () => {
    events.create.mockRejectedValue(uniqueViolation());
    events.findUnique.mockResolvedValue({
      id: 'evt-1',
      status: 'PROCESSING',
      claimedAt: new Date(),
    } as never);
    await expect(claimProviderWebhookEvent('org-1', 'key-1', 'account_alerts')).resolves.toBe(false);
    expect(events.updateMany).not.toHaveBeenCalled();
  });

  it('reclaims a stale PROCESSING row after a crash', async () => {
    const claimedAt = new Date(Date.now() - PROVIDER_WEBHOOK_CLAIM_STALE_MS - 1);
    events.create.mockRejectedValue(uniqueViolation());
    events.findUnique.mockResolvedValue({
      id: 'evt-1',
      status: 'PROCESSING',
      claimedAt,
    } as never);
    events.updateMany.mockResolvedValue({ count: 1 } as never);
    await expect(claimProviderWebhookEvent('org-1', 'key-1', 'account_alerts')).resolves.toBe(true);
    expect(events.updateMany).toHaveBeenCalledWith({
      where: { id: 'evt-1', status: 'PROCESSING', claimedAt },
      data: expect.objectContaining({ field: 'account_alerts' }),
    });
  });

  it('completes only PROCESSING claims', async () => {
    events.updateMany.mockResolvedValue({ count: 1 } as never);
    await completeProviderWebhookEvent('org-1', 'key-1');
    expect(events.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', eventKey: 'key-1', status: 'PROCESSING' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
  });

  it('releases only PROCESSING claims on handler failure', async () => {
    events.deleteMany.mockResolvedValue({ count: 1 } as never);
    await releaseProviderWebhookEvent('org-1', 'key-1');
    expect(events.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', eventKey: 'key-1', status: 'PROCESSING' },
    });
  });
});
