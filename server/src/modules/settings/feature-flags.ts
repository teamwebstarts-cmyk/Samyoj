import prisma from '../../config/database';

export const KNOWN_FEATURE_FLAGS = [
  'content_studio',
  'voice_studio',
  'video_studio',
  'public_api',
  'zapier_integration',
  'commerce',
  'calling',
  'help_center',
] as const;

export type FeatureFlagName = (typeof KNOWN_FEATURE_FLAGS)[number];

export const HELP_CENTER_FLAG = 'help_center' satisfies FeatureFlagName;

/** Flags that are on when the org has no row. Help Center is platform-default-on. */
export const DEFAULT_ON_FLAGS: ReadonlySet<string> = new Set([HELP_CENTER_FLAG]);

export function isFlagEnabled(
  flag: string,
  recordEnabled: boolean | undefined
): boolean {
  if (typeof recordEnabled === 'boolean') return recordEnabled;
  return DEFAULT_ON_FLAGS.has(flag);
}

export function parseHelpCenterDailyCap(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const cap = (metadata as { dailyMessageCap?: unknown }).dailyMessageCap;
  if (typeof cap === 'number' && Number.isInteger(cap) && cap > 0 && cap <= 100_000) return cap;
  return null;
}

export async function isFeatureEnabled(
  organizationId: string,
  flag: string
): Promise<boolean> {
  const record = await prisma.orgFeatureFlag.findUnique({
    where: { organizationId_flag: { organizationId, flag } },
  });
  return isFlagEnabled(flag, record?.enabled);
}

export async function getOrgFeatureFlags(organizationId: string) {
  const flags = await prisma.orgFeatureFlag.findMany({
    where: { organizationId },
    orderBy: { flag: 'asc' },
  });

  const map = new Map(flags.map((f) => [f.flag, f]));
  return KNOWN_FEATURE_FLAGS.map((flag) => {
    const row = map.get(flag);
    const metadata = row?.metadata ?? null;
    return {
      flag,
      enabled: isFlagEnabled(flag, row?.enabled),
      metadata,
      dailyMessageCap: flag === HELP_CENTER_FLAG ? parseHelpCenterDailyCap(metadata) : null,
    };
  });
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
