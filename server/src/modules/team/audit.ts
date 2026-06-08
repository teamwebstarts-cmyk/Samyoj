import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import type { TeamAuditAction } from '@prisma/client';

export async function logTeamAudit(params: {
  organizationId: string;
  actorId?: string | null;
  action: TeamAuditAction;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.teamAuditLog.create({
    data: {
      organizationId: params.organizationId,
      actorId: params.actorId ?? null,
      action: params.action,
      targetUserId: params.targetUserId ?? null,
      metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
