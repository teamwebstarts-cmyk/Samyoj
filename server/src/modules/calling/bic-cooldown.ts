/**
 * Pure helpers for local unanswered BIC (business-initiated call) cooldown.
 * Meta can revoke call permission after consecutive unanswered outbound calls;
 * these counters let us pause dialing before we burn permission quality.
 */

export const DEFAULT_BIC_MAX_UNANSWERED = 2;
export const DEFAULT_BIC_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function nextBicUnansweredCount(
  current: number,
  outcome: 'answered' | 'unanswered' | 'connected'
): number {
  if (outcome === 'answered' || outcome === 'connected') return 0;
  return Math.max(0, current) + 1;
}

export function isBicInUnansweredCooldown(params: {
  consecutiveUnanswered: number;
  lastUnansweredAt: Date | null;
  maxUnanswered?: number;
  cooldownMs?: number;
  now?: Date;
}): boolean {
  const maxUnanswered = params.maxUnanswered ?? DEFAULT_BIC_MAX_UNANSWERED;
  const cooldownMs = params.cooldownMs ?? DEFAULT_BIC_COOLDOWN_MS;
  if (params.consecutiveUnanswered < maxUnanswered) return false;
  if (!params.lastUnansweredAt) return true;
  const now = params.now ?? new Date();
  return now.getTime() - params.lastUnansweredAt.getTime() < cooldownMs;
}
