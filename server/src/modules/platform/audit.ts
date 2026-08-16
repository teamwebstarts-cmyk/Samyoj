import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { sanitizeAuditState } from './privacy';

export async function writePlatformAudit(input: {
  operatorId: string;
  action: string;
  organizationId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  reason?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
}): Promise<void> {
  await prisma.platformAuditLog.create({
    data: {
      operatorId: input.operatorId,
      action: input.action,
      organizationId: input.organizationId || undefined,
      targetType: input.targetType || undefined,
      targetId: input.targetId || undefined,
      reason: input.reason || undefined,
      beforeState: sanitizeAuditState(input.beforeState ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      afterState: sanitizeAuditState(input.afterState ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
    },
  });
}
