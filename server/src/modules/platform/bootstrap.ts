import bcrypt from 'bcryptjs';
import { Prisma, type PlatformRole } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../config/database';
import { assertPasswordPolicy } from '../auth/password-policy';
import { AppError } from '../../utils/response';

interface PlatformBootstrapTransaction {
  platformOperator: {
    count(): Promise<number>;
    create(args: {
      data: { email: string; passwordHash: string; role: PlatformRole };
      select: {
        id: true;
        email: true;
        role: true;
        mfaEnabledAt: true;
        createdAt: true;
      };
    }): Promise<{
      id: string;
      email: string;
      role: PlatformRole;
      mfaEnabledAt: Date | null;
      createdAt: Date;
    }>;
  };
  platformAuditLog: {
    create(args: {
      data: {
        operatorId: string;
        action: string;
        targetType: string;
        targetId: string;
        afterState: { role: PlatformRole };
      };
    }): Promise<unknown>;
  };
}

interface PlatformBootstrapDatabase {
  $transaction<T>(
    callback: (tx: PlatformBootstrapTransaction) => Promise<T>,
    options?: { isolationLevel: Prisma.TransactionIsolationLevel }
  ): Promise<T>;
}

export interface BootstrapPlatformOperatorInput {
  email: string;
  password: string;
}

function bootstrapConflict(): AppError {
  return new AppError(
    409,
    'Platform bootstrap is locked because an operator already exists',
    'PLATFORM_BOOTSTRAP_LOCKED'
  );
}

export async function bootstrapPlatformOperator(
  input: BootstrapPlatformOperatorInput,
  database: PlatformBootstrapDatabase = prisma as unknown as PlatformBootstrapDatabase
) {
  const email = z.string().email().max(255).parse(input.email.toLowerCase().trim());
  const role: PlatformRole = 'SUPER_ADMIN';
  assertPasswordPolicy(input.password);
  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    return await database.$transaction(
      async (tx) => {
        if ((await tx.platformOperator.count()) !== 0) {
          throw bootstrapConflict();
        }

        const operator = await tx.platformOperator.create({
          data: { email, passwordHash, role },
          select: {
            id: true,
            email: true,
            role: true,
            mfaEnabledAt: true,
            createdAt: true,
          },
        });

        await tx.platformAuditLog.create({
          data: {
            operatorId: operator.id,
            action: 'PLATFORM_OPERATOR_BOOTSTRAPPED',
            targetType: 'PlatformOperator',
            targetId: operator.id,
            afterState: { role: operator.role },
          },
        });

        return operator;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2034' || error.code === 'P2002')
    ) {
      throw bootstrapConflict();
    }
    throw error;
  }
}
