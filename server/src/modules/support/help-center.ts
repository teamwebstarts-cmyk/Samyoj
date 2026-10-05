import getRedis from '../../config/redis';
import { AppError } from '../../utils/response';
import { isAiConfigured } from '../ai/chat-completion.service';
import prisma from '../../config/database';
import {
  HELP_CENTER_FLAG,
  isFlagEnabled,
  parseHelpCenterDailyCap,
} from '../settings/feature-flags';

export type HelpCenterReason = 'ready' | 'ai_unconfigured' | 'disabled' | 'daily_cap';

export interface HelpCenterPolicy {
  enabled: boolean;
  dailyCap: number | null;
  dailyUsed: number;
  aiConfigured: boolean;
  reason: HelpCenterReason;
  assistantOnline: boolean;
}

export function helpCenterDayKey(organizationId: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return `help-center:${organizationId}:${day}`;
}

export function secondsUntilUtcMidnight(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export function helpCenterStatusReason(input: {
  enabled: boolean;
  aiConfigured: boolean;
  dailyCap: number | null;
  dailyUsed: number;
}): HelpCenterReason {
  if (!input.enabled) return 'disabled';
  if (input.dailyCap != null && input.dailyUsed >= input.dailyCap) return 'daily_cap';
  if (!input.aiConfigured) return 'ai_unconfigured';
  return 'ready';
}

export async function getHelpCenterDailyUsed(organizationId: string, now = new Date()): Promise<number> {
  try {
    const raw = await getRedis().get(helpCenterDayKey(organizationId, now));
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  } catch {
    return 0;
  }
}

export async function loadHelpCenterPolicy(organizationId: string): Promise<HelpCenterPolicy> {
  const [record, aiConfigured, dailyUsed] = await Promise.all([
    prisma.orgFeatureFlag.findUnique({
      where: { organizationId_flag: { organizationId, flag: HELP_CENTER_FLAG } },
    }),
    isAiConfigured(organizationId),
    getHelpCenterDailyUsed(organizationId),
  ]);
  const enabled = isFlagEnabled(HELP_CENTER_FLAG, record?.enabled);
  const dailyCap = parseHelpCenterDailyCap(record?.metadata);
  const reason = helpCenterStatusReason({ enabled, aiConfigured, dailyCap, dailyUsed });
  return {
    enabled,
    dailyCap,
    dailyUsed,
    aiConfigured,
    reason,
    assistantOnline: reason === 'ready',
  };
}

export async function consumeHelpCenterTurn(organizationId: string, dailyCap: number | null): Promise<void> {
  if (dailyCap == null) return;
  try {
    const redis = getRedis();
    const key = helpCenterDayKey(organizationId);
    const used = await redis.incr(key);
    if (used === 1) await redis.expire(key, secondsUntilUtcMidnight());
    if (used > dailyCap) {
      throw new AppError(
        429,
        'Help assistant limit for today — try tomorrow, or ask your platform admin.',
        'HELP_CENTER_DAILY_CAP'
      );
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Redis down: fail-open so product help still works.
  }
}

export async function assertHelpCenterChatAllowed(organizationId: string): Promise<HelpCenterPolicy> {
  const policy = await loadHelpCenterPolicy(organizationId);
  if (!policy.enabled) {
    throw new AppError(
      403,
      'Help assistant is turned off for this workspace.',
      'HELP_CENTER_DISABLED'
    );
  }
  if (policy.reason === 'daily_cap') {
    throw new AppError(
      429,
      'Help assistant limit for today — try tomorrow, or ask your platform admin.',
      'HELP_CENTER_DAILY_CAP'
    );
  }
  await consumeHelpCenterTurn(organizationId, policy.dailyCap);
  return policy;
}
