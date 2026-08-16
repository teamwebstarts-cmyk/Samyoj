import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../config/database';
import {
  conversationsWhereForWorkspace,
  saveWhatsappNumberWorkspace,
} from './save-connection';

vi.mock('../../config/database', () => ({
  default: {
    whatsappNumber: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const numberMock = vi.mocked(prisma.whatsappNumber);
const txMock = {
  whatsappNumber: {
    create: vi.fn(),
    update: vi.fn(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
    return (fn as (tx: typeof txMock) => Promise<unknown>)(txMock);
  });
});

const connection = {
  phoneNumber: '+91 99999 00001',
  phoneNumberId: 'meta-phone-1',
  wabaId: 'waba-1',
  businessId: 'biz-1',
  encryptedToken: 'enc-token',
};

describe('saveWhatsappNumberWorkspace', () => {
  it('409s while another org is still active on the same Meta id', async () => {
    numberMock.findFirst
      .mockResolvedValueOnce({ id: 'wa-a', organizationId: 'org-a' } as never)
      .mockResolvedValueOnce(null);

    await expect(saveWhatsappNumberWorkspace('org-b', connection)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/another organization/i),
    });
    expect(txMock.whatsappNumber.create).not.toHaveBeenCalled();
    expect(txMock.whatsappNumber.update).not.toHaveBeenCalled();
  });

  it('creates a new empty workspace for org B after org A disconnects (does not reuse A)', async () => {
    numberMock.findFirst
      .mockResolvedValueOnce(null) // no active cross-org phoneNumberId
      .mockResolvedValueOnce(null) // no active cross-org normalized phone
      .mockResolvedValueOnce(null) // B has no in-org row by phone
      .mockResolvedValueOnce(null); // B has no in-org row by provider id

    txMock.whatsappNumber.create.mockResolvedValue({
      id: 'wa-b',
      organizationId: 'org-b',
      phoneNumberId: 'meta-phone-1',
    });

    const result = await saveWhatsappNumberWorkspace('org-b', connection);

    expect(result.created).toBe(true);
    expect(result.whatsappNumber.id).toBe('wa-b');
    expect(txMock.whatsappNumber.update).not.toHaveBeenCalled();
    expect(txMock.whatsappNumber.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-b',
        phoneNumberId: 'meta-phone-1',
        isActive: true,
      }),
    });
  });

  it('reuses the in-org workspace when reconnecting the same displayed phone', async () => {
    numberMock.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'wa-a',
        organizationId: 'org-a',
        normalizedPhoneNumber: '919999900001',
        phoneNumberId: 'meta-phone-old',
      } as never)
      .mockResolvedValueOnce(null);

    txMock.whatsappNumber.update.mockResolvedValue({
      id: 'wa-a',
      organizationId: 'org-a',
      phoneNumberId: 'meta-phone-1',
    });

    const result = await saveWhatsappNumberWorkspace('org-a', connection);

    expect(result.created).toBe(false);
    expect(result.whatsappNumber.id).toBe('wa-a');
    expect(txMock.whatsappNumber.create).not.toHaveBeenCalled();
    expect(txMock.whatsappNumber.update).toHaveBeenCalledWith({
      where: { id: 'wa-a' },
      data: expect.objectContaining({
        phoneNumberId: 'meta-phone-1',
        isActive: true,
      }),
    });
  });

  it('maps a partial-unique race to 409', async () => {
    numberMock.findFirst.mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      })
    );

    await expect(saveWhatsappNumberWorkspace('org-b', connection)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe('org B cannot read org A conversations', () => {
  it('findMany scope for B’s new workspace never matches A’s rows', () => {
    const orgAConversations = [
      { id: 'c-a', organizationId: 'org-a', whatsappNumberId: 'wa-a' },
    ];
    const bWhere = conversationsWhereForWorkspace('org-b', 'wa-b');

    const visibleToB = orgAConversations.filter(
      (row) =>
        row.organizationId === bWhere.organizationId &&
        row.whatsappNumberId === (bWhere as { whatsappNumberId?: string }).whatsappNumberId
    );

    expect(bWhere).toEqual({ organizationId: 'org-b', whatsappNumberId: 'wa-b' });
    expect(visibleToB).toEqual([]);
    expect(
      orgAConversations.filter((row) => row.organizationId === 'org-a' && row.whatsappNumberId === 'wa-a')
    ).toHaveLength(1);
  });
});
