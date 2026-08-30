import { Prisma } from '@prisma/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
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
}));

const echoesMock = vi.hoisted(() => vi.fn().mockResolvedValue(1));
const historyMock = vi.hoisted(() => vi.fn().mockResolvedValue(1));
const appStateMock = vi.hoisted(() => vi.fn().mockResolvedValue(1));
const accountMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../../config/database', () => ({ default: prismaMock }));
vi.mock('./echoes', () => ({ processMessageEchoes: echoesMock }));
vi.mock('./history', () => ({ processHistorySync: historyMock }));
vi.mock('./contacts-sync', () => ({ processAppStateSync: appStateMock }));
vi.mock('./lifecycle', () => ({ processAccountUpdate: accountMock }));

import {
  processCoexistenceWebhookFields,
  resolveCoexistenceWhatsappNumber,
  coexistenceWebhookEventKey,
} from './index';

const numberRow = {
  id: 'wn1',
  organizationId: 'org1',
  phoneNumber: '+919999999999',
  phoneNumberId: 'meta-phone-1',
  wabaId: 'waba-1',
  accessToken: 'enc',
  isActive: true,
};

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.0.0',
  });
}

describe('coexistence webhook routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.providerWebhookEvent.create.mockResolvedValue({ id: 'evt-1' });
    prismaMock.providerWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.providerWebhookEvent.deleteMany.mockResolvedValue({ count: 1 });
  });

  it('refuses WABA-only routing when 2+ active numbers exist', async () => {
    prismaMock.whatsappNumber.findMany.mockResolvedValue([
      { ...numberRow, id: 'wn1' },
      { ...numberRow, id: 'wn2', phoneNumberId: 'meta-phone-2' },
    ]);

    await expect(
      resolveCoexistenceWhatsappNumber('waba-1', { history: [] })
    ).resolves.toBeNull();
    expect(prismaMock.whatsappNumber.findFirst).not.toHaveBeenCalled();
  });

  it('does not ingest on another number when phone_number_id is unknown', async () => {
    prismaMock.whatsappNumber.findFirst.mockResolvedValue(null);

    await processCoexistenceWebhookFields({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-1',
          time: 1700000000,
          changes: [
            {
              field: 'history',
              value: {
                metadata: { phone_number_id: 'unknown-phone' },
                history: [{ metadata: { progress: 10 }, threads: [] }],
              },
            },
          ],
        },
      ],
    });

    expect(prismaMock.whatsappNumber.findMany).not.toHaveBeenCalled();
    expect(historyMock).not.toHaveBeenCalled();
    expect(prismaMock.providerWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('routes a unique WABA number when phone_number_id is absent', async () => {
    prismaMock.whatsappNumber.findMany.mockResolvedValue([numberRow]);

    await expect(
      resolveCoexistenceWhatsappNumber('waba-1', { event: 'ACCOUNT_OFFBOARDED' })
    ).resolves.toEqual(numberRow);
  });
});

describe('coexistence webhook idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.whatsappNumber.findFirst.mockResolvedValue(numberRow);
    prismaMock.providerWebhookEvent.create.mockResolvedValue({ id: 'evt-1' });
    prismaMock.providerWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.providerWebhookEvent.deleteMany.mockResolvedValue({ count: 1 });
  });

  it('claims with field + waba + phone + message id, then completes', async () => {
    const value = {
      metadata: { phone_number_id: 'meta-phone-1' },
      message_echoes: [{ id: 'wamid.echo1', to: '9188' }],
    };

    await processCoexistenceWebhookFields({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-1',
          time: 1700000000,
          changes: [{ field: 'smb_message_echoes', value }],
        },
      ],
    });

    const eventKey = coexistenceWebhookEventKey({
      field: 'smb_message_echoes',
      wabaId: 'waba-1',
      phoneNumberId: 'meta-phone-1',
      entryTime: 1700000000,
      value,
    });
    expect(eventKey).toContain('smb_message_echoes');
    expect(eventKey).toContain('waba-1');
    expect(eventKey).toContain('meta-phone-1');
    expect(eventKey).toContain('wamid.echo1');
    expect(prismaMock.providerWebhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org1',
        eventKey,
        field: 'smb_message_echoes',
        status: 'PROCESSING',
      }),
    });
    expect(echoesMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.providerWebhookEvent.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org1', eventKey, status: 'PROCESSING' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
  });

  it('skips handlers when the claim is already completed (Meta retry)', async () => {
    prismaMock.providerWebhookEvent.create.mockRejectedValue(uniqueViolation());
    prismaMock.providerWebhookEvent.findUnique.mockResolvedValue({
      id: 'evt-1',
      status: 'COMPLETED',
      claimedAt: new Date(),
    });

    await processCoexistenceWebhookFields({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-1',
          time: 1700000001,
          changes: [
            {
              field: 'account_update',
              value: {
                metadata: { phone_number_id: 'meta-phone-1' },
                event: 'ACCOUNT_OFFBOARDED',
              },
            },
          ],
        },
      ],
    });

    expect(accountMock).not.toHaveBeenCalled();
    expect(prismaMock.providerWebhookEvent.updateMany).not.toHaveBeenCalled();
  });

  it('releases the claim when the handler throws', async () => {
    historyMock.mockRejectedValueOnce(new Error('ingest failed'));

    await expect(
      processCoexistenceWebhookFields({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-1',
            time: 1700000002,
            changes: [
              {
                field: 'history',
                value: {
                  metadata: { phone_number_id: 'meta-phone-1' },
                  history: [{ metadata: { progress: 10 }, threads: [] }],
                },
              },
            ],
          },
        ],
      })
    ).rejects.toThrow('ingest failed');

    expect(prismaMock.providerWebhookEvent.deleteMany).toHaveBeenCalled();
    expect(prismaMock.providerWebhookEvent.updateMany).not.toHaveBeenCalled();
  });
});
