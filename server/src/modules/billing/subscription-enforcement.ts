import prisma from '../../config/database';

export const SUBSCRIPTION_ENFORCEMENT_KEY = 'SUBSCRIPTION_ENFORCEMENT';

const CACHE_MS = 3000;
let cache: { at: number; enabled: boolean } | null = null;

export function resetSubscriptionEnforcementCache(): void {
  cache = null;
}

function readEnabled(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return (value as { enabled?: unknown }).enabled === true;
}

/** Missing row means off so local and first production deploys can test without a purchase. */
export async function isSubscriptionEnforcementEnabled(): Promise<boolean> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.enabled;
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { key: SUBSCRIPTION_ENFORCEMENT_KEY },
    });
    const enabled = readEnabled(row?.value);
    cache = { at: Date.now(), enabled };
    return enabled;
  } catch {
    return false;
  }
}

export async function setSubscriptionEnforcementEnabled(enabled: boolean): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key: SUBSCRIPTION_ENFORCEMENT_KEY },
    update: { value: { enabled } },
    create: { key: SUBSCRIPTION_ENFORCEMENT_KEY, value: { enabled } },
  });
  cache = { at: Date.now(), enabled };
}
