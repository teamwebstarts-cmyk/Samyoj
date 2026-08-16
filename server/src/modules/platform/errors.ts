import prisma from '../../config/database';
import { officialMetaErrorTitle } from './meta-errors';

export async function listPlatformErrors(input: {
  organizationId?: string;
  days?: number;
}) {
  const days = Math.min(90, Math.max(1, input.days ?? 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = {
    lastAt: { gte: since },
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
  };

  const [grouped, recent] = await Promise.all([
    prisma.metaErrorStat.groupBy({
      by: ['code'],
      where,
      _sum: { count: true },
      _max: { lastAt: true },
      orderBy: { _sum: { count: 'desc' } },
      take: 40,
    }),
    prisma.metaErrorStat.findMany({
      where,
      orderBy: { lastAt: 'desc' },
      take: 50,
      select: {
        organizationId: true,
        code: true,
        count: true,
        sampleTitle: true,
        lastAt: true,
        bucketDate: true,
        organization: { select: { companyName: true } },
      },
    }),
  ]);

  return {
    days,
    codes: grouped.map((row) => ({
      code: row.code,
      title: officialMetaErrorTitle(row.code),
      count: row._sum.count || 0,
      lastAt: row._max.lastAt,
      sampleTitle: officialMetaErrorTitle(row.code),
    })),
    recent: recent.map((row) => ({
      organizationId: row.organizationId,
      companyName: row.organization.companyName,
      code: row.code,
      title: officialMetaErrorTitle(row.code),
      count: row.count,
      sampleTitle: row.sampleTitle,
      lastAt: row.lastAt,
      bucketDate: row.bucketDate,
    })),
  };
}

export async function listPlatformAudit(input: {
  organizationId?: string;
  action?: string;
  page?: number;
}) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = 40;
  const where = {
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    ...(input.action ? { action: input.action } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.platformAuditLog.count({ where }),
    prisma.platformAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        organizationId: true,
        targetType: true,
        targetId: true,
        reason: true,
        beforeState: true,
        afterState: true,
        createdAt: true,
        operator: { select: { email: true, role: true } },
        organization: { select: { companyName: true } },
      },
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    rows: rows.map((row) => ({
      id: row.id,
      action: row.action,
      organizationId: row.organizationId,
      companyName: row.organization?.companyName ?? null,
      operatorEmail: row.operator.email,
      operatorRole: row.operator.role,
      targetType: row.targetType,
      targetId: row.targetId,
      reason: row.reason,
      beforeState: row.beforeState,
      afterState: row.afterState,
      createdAt: row.createdAt,
    })),
  };
}
