import bcrypt from 'bcryptjs';
import type { PlatformRole } from '@prisma/client';
import prisma from '../../config/database';
import { assertPasswordPolicy } from '../auth/password-policy';
import { AppError } from '../../utils/response';
import { writePlatformAudit } from './audit';

function publicOperator(operator: {
  id: string;
  email: string;
  role: PlatformRole;
  mfaEnabledAt: Date | null;
  disabledAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: operator.id,
    email: operator.email,
    role: operator.role,
    mfaEnabled: Boolean(operator.mfaEnabledAt),
    disabled: Boolean(operator.disabledAt),
    createdAt: operator.createdAt,
  };
}

export async function listPlatformOperators() {
  const operators = await prisma.platformOperator.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      role: true,
      mfaEnabledAt: true,
      disabledAt: true,
      createdAt: true,
    },
  });
  return operators.map(publicOperator);
}

export async function createPlatformOperator(input: {
  actorId: string;
  email: string;
  password: string;
  role: PlatformRole;
  reason: string;
}) {
  const email = input.email.toLowerCase().trim();
  assertPasswordPolicy(input.password);
  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const operator = await prisma.platformOperator.create({
      data: { email, passwordHash, role: input.role },
      select: {
        id: true,
        email: true,
        role: true,
        mfaEnabledAt: true,
        disabledAt: true,
        createdAt: true,
      },
    });
    await writePlatformAudit({
      operatorId: input.actorId,
      action: 'PLATFORM_OPERATOR_CREATED',
      targetType: 'PlatformOperator',
      targetId: operator.id,
      reason: input.reason,
      afterState: { role: operator.role },
    });
    return publicOperator(operator);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new AppError(409, 'A platform operator with that email already exists');
    }
    throw error;
  }
}

export async function patchPlatformOperator(input: {
  actorId: string;
  operatorId: string;
  reason: string;
  role?: PlatformRole;
  disabled?: boolean;
}) {
  const operator = await prisma.platformOperator.findUnique({
    where: { id: input.operatorId },
    select: { id: true, role: true, disabledAt: true },
  });
  if (!operator) throw new AppError(404, 'Platform operator not found');

  if (input.disabled === true || input.role === 'SUPPORT' || input.role === 'ANALYST') {
    const remainingAdmins = await prisma.platformOperator.count({
      where: {
        role: 'SUPER_ADMIN',
        disabledAt: null,
        id: { not: operator.id },
      },
    });
    const wouldRemoveLastAdmin =
      operator.role === 'SUPER_ADMIN' &&
      remainingAdmins === 0 &&
      (input.disabled === true || (input.role && input.role !== 'SUPER_ADMIN'));
    if (wouldRemoveLastAdmin) {
      throw new AppError(409, 'Cannot disable or demote the last SUPER_ADMIN');
    }
  }

  const updated = await prisma.platformOperator.update({
    where: { id: operator.id },
    data: {
      ...(input.role ? { role: input.role } : {}),
      ...(input.disabled === true ? { disabledAt: new Date() } : {}),
      ...(input.disabled === false ? { disabledAt: null } : {}),
    },
    select: {
      id: true,
      email: true,
      role: true,
      mfaEnabledAt: true,
      disabledAt: true,
      createdAt: true,
    },
  });

  if (input.disabled === true) {
    await prisma.platformSession.updateMany({
      where: { operatorId: operator.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await writePlatformAudit({
    operatorId: input.actorId,
    action: 'PLATFORM_OPERATOR_UPDATED',
    targetType: 'PlatformOperator',
    targetId: operator.id,
    reason: input.reason,
    beforeState: {
      role: operator.role,
      disabled: Boolean(operator.disabledAt),
    },
    afterState: {
      role: updated.role,
      disabled: Boolean(updated.disabledAt),
    },
  });

  return publicOperator(updated);
}

export async function listPlatformSessions(input: {
  actorId: string;
  actorRole: PlatformRole;
}) {
  const sessions = await prisma.platformSession.findMany({
    where: {
      revokedAt: null,
      expiresAt: { gt: new Date() },
      ...(input.actorRole === 'SUPER_ADMIN' ? {} : { operatorId: input.actorId }),
    },
    orderBy: { lastSeenAt: 'desc' },
    select: {
      id: true,
      operatorId: true,
      mfaVerifiedAt: true,
      expiresAt: true,
      lastSeenAt: true,
      createdAt: true,
      operator: { select: { email: true, role: true } },
    },
  });

  return sessions.map((session) => ({
    id: session.id,
    operatorId: session.operatorId,
    operatorEmail: session.operator.email,
    operatorRole: session.operator.role,
    mfaVerified: Boolean(session.mfaVerifiedAt),
    expiresAt: session.expiresAt,
    lastSeenAt: session.lastSeenAt,
    createdAt: session.createdAt,
    current: session.operatorId === input.actorId,
  }));
}

export async function revokeManagedPlatformSession(input: {
  actorId: string;
  actorRole: PlatformRole;
  sessionId: string;
  currentSessionId: string;
  reason: string;
}) {
  const session = await prisma.platformSession.findUnique({
    where: { id: input.sessionId },
    select: { id: true, operatorId: true, revokedAt: true },
  });
  if (!session || session.revokedAt) throw new AppError(404, 'Session not found');
  if (input.actorRole !== 'SUPER_ADMIN' && session.operatorId !== input.actorId) {
    throw new AppError(403, 'Insufficient platform permissions');
  }
  if (session.id === input.currentSessionId) {
    throw new AppError(400, 'Use logout to end the current session');
  }

  await prisma.platformSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });
  await writePlatformAudit({
    operatorId: input.actorId,
    action: 'PLATFORM_SESSION_REVOKED',
    targetType: 'PlatformSession',
    targetId: session.id,
    reason: input.reason,
    afterState: { sessionId: session.id },
  });
  return { revoked: true };
}
