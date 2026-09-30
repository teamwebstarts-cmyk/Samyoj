import prisma from '../../config/database';

export const KNOWN_FEATURE_FLAGS = [
  'public_api',
  'zapier_integration',
  'commerce',
  'calling',
] as const;

export type FeatureFlagName = (typeof KNOWN_FEATURE_FLAGS)[number];

export async function isFeatureEnabled(
  organizationId: string,
  flag: string
): Promise<boolean> {
  const record = await prisma.orgFeatureFlag.findUnique({
    where: { organizationId_flag: { organizationId, flag } },
  });
  return record?.enabled ?? false;
}

export async function getOrgFeatureFlags(organizationId: string) {
  const flags = await prisma.orgFeatureFlag.findMany({
    where: { organizationId },
    orderBy: { flag: 'asc' },
  });

  const map = new Map(flags.map((f) => [f.flag, f]));
  return KNOWN_FEATURE_FLAGS.map((flag) => ({
    flag,
    enabled: map.get(flag)?.enabled ?? false,
    metadata: map.get(flag)?.metadata ?? null,
  }));
}

export async function setFeatureFlag(
  organizationId: string,
  flag: string,
  enabled: boolean,
  metadata?: Record<string, unknown>
) {
  return prisma.orgFeatureFlag.upsert({
    where: { organizationId_flag: { organizationId, flag } },
    create: {
      organizationId,
      flag,
      enabled,
      metadata: metadata ? (metadata as object) : undefined,
    },
    update: {
      enabled,
      ...(metadata !== undefined ? { metadata: metadata as object } : {}),
    },
  });
}

export async function requireFeature(organizationId: string, flag: string): Promise<void> {
  const enabled = await isFeatureEnabled(organizationId, flag);
  if (!enabled) {
    const { AppError } = await import('../../utils/response');
    throw new AppError(403, `Feature "${flag}" is not enabled for this organization`);
  }
}
