import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapPlatformOperator } from './bootstrap';

const operator = {
  id: 'operator-1',
  email: 'admin@example.com',
  role: 'SUPER_ADMIN' as const,
  mfaEnabledAt: null,
  createdAt: new Date('2026-08-17T00:00:00.000Z'),
};

const transaction = {
  platformOperator: {
    count: vi.fn(),
    create: vi.fn(),
  },
  platformAuditLog: {
    create: vi.fn(),
  },
};

const runTransaction = vi.fn(
  async (
    callback: (tx: typeof transaction) => Promise<unknown>
  ): Promise<unknown> => callback(transaction)
);
const database = {
  $transaction: runTransaction,
} as unknown as NonNullable<Parameters<typeof bootstrapPlatformOperator>[1]>;

describe('platform operator bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.platformOperator.count.mockResolvedValue(0);
    transaction.platformOperator.create.mockResolvedValue(operator);
    transaction.platformAuditLog.create.mockResolvedValue({});
  });

  it('creates only the first independent operator with a bcrypt password hash', async () => {
    const created = await bootstrapPlatformOperator(
      {
        email: '  ADMIN@Example.com ',
        password: 'StrongPass123',
      },
      database
    );

    expect(created).toEqual(operator);
    const createData = transaction.platformOperator.create.mock.calls[0][0].data;
    expect(createData.email).toBe('admin@example.com');
    expect(createData.passwordHash).not.toBe('StrongPass123');
    await expect(
      bcrypt.compare('StrongPass123', createData.passwordHash)
    ).resolves.toBe(true);
    expect(transaction.platformAuditLog.create).toHaveBeenCalledWith({
      data: {
        operatorId: 'operator-1',
        action: 'PLATFORM_OPERATOR_BOOTSTRAPPED',
        targetType: 'PlatformOperator',
        targetId: 'operator-1',
        afterState: { role: 'SUPER_ADMIN' },
      },
    });
  });

  it('locks bootstrap after any platform operator exists', async () => {
    transaction.platformOperator.count.mockResolvedValueOnce(1);

    await expect(
      bootstrapPlatformOperator(
        {
          email: 'second@example.com',
          password: 'StrongPass123',
        },
        database
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'PLATFORM_BOOTSTRAP_LOCKED',
    });
    expect(transaction.platformOperator.create).not.toHaveBeenCalled();
  });

  it('maps a concurrent serializable transaction conflict to bootstrap conflict', async () => {
    runTransaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: 'test',
      })
    );

    await expect(
      bootstrapPlatformOperator(
        {
          email: 'racing@example.com',
          password: 'StrongPass123',
        },
        database
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'PLATFORM_BOOTSTRAP_LOCKED',
    });
  });
});
