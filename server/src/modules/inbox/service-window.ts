import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';

export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Ignore provider clocks that are only slightly ahead. A far-future stamp must not hold the window open. */
const WINDOW_CLOCK_SKEW_MS = 2 * 60 * 1000;

export function serviceWindowOpenSince(now = new Date()): Date {
  return new Date(now.getTime() - CUSTOMER_SERVICE_WINDOW_MS);
}

/**
 * Anchor used for the 24h check.
 * A few minutes of clock skew counts as "now". A timestamp hours or years ahead is invalid.
 */
export function effectiveWindowAnchor(opensAt: Date, now = new Date()): Date | null {
  if (!(opensAt instanceof Date) || Number.isNaN(opensAt.getTime())) return null;
  if (opensAt.getTime() > now.getTime() + WINDOW_CLOCK_SKEW_MS) return null;
  if (opensAt.getTime() > now.getTime()) return now;
  return opensAt;
}

export function windowStillOpen(opensAt: Date | null | undefined, now = new Date()): boolean {
  if (!opensAt) return false;
  const anchor = effectiveWindowAnchor(opensAt, now);
  if (!anchor) return false;
  return now.getTime() - anchor.getTime() < CUSTOMER_SERVICE_WINDOW_MS;
}

export function windowExpiresAt(opensAt: Date | null | undefined, now = new Date()): Date | null {
  if (!opensAt) return null;
  const anchor = effectiveWindowAnchor(opensAt, now);
  if (!anchor) return null;
  return new Date(anchor.getTime() + CUSTOMER_SERVICE_WINDOW_MS);
}

/** Messenger and Instagram webhooks send milliseconds. A short number is Unix seconds. */
export function messagingEventInstant(timestampMs: number | undefined, now = new Date()): Date {
  if (timestampMs == null || !Number.isFinite(timestampMs) || timestampMs <= 0) return now;
  const ms = timestampMs < 1e12 ? timestampMs * 1000 : timestampMs;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return now;
  return effectiveWindowAnchor(date, now) ?? now;
}

export function inboxListOrderBy(
  windowFilter?: string
): Array<Record<string, unknown>> {
  if (windowFilter === 'open' || windowFilter === 'closed') {
    return [{ lastMessageAt: 'desc' }, { id: 'desc' }];
  }
  return [
    { cs24hWindowOpensAt: { sort: 'desc', nulls: 'last' } },
    { lastMessageAt: 'desc' },
    { id: 'desc' },
  ];
}
export function conversationServiceWindowWhere(
  kind: 'open' | 'closed',
  now = new Date()
): Prisma.ConversationWhereInput {
  const since = serviceWindowOpenSince(now);
  const latestAllowed = new Date(now.getTime() + 2 * 60 * 1000);
  if (kind === 'open') {
    return { cs24hWindowOpensAt: { gte: since, lte: latestAllowed } };
  }
  return {
    OR: [
      { cs24hWindowOpensAt: null },
      { cs24hWindowOpensAt: { lt: since } },
      { cs24hWindowOpensAt: { gt: latestAllowed } },
    ],
  };
}

/** Latest of inbound message / user-initiated call / stored CSW open timestamps. */
export function latestWindowOpenAt(...dates: Array<Date | null | undefined>): Date | null {
  let max = 0;
  for (const date of dates) {
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      max = Math.max(max, date.getTime());
    }
  }
  return max ? new Date(max) : null;
}

/** Resolve when the customer service window opened (stored field, last inbound, or user call). */
export async function resolveCs24hWindowOpensAt(
  conversationId: string,
  cs24hWindowOpensAt: Date | null | undefined,
  persist = true
): Promise<Date | null> {
  const [lastInbound, lastUserCall] = await Promise.all([
    prisma.message.findFirst({
      where: { conversationId, direction: 'INBOUND' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.call.findFirst({
      where: { conversationId, direction: 'USER_INITIATED' },
      orderBy: { createdAt: 'desc' },
      select: { startedAt: true, createdAt: true },
    }),
  ]);

  const resolved = latestWindowOpenAt(
    cs24hWindowOpensAt,
    lastInbound?.createdAt,
    lastUserCall?.startedAt,
    lastUserCall?.createdAt
  );

  if (
    persist &&
    resolved &&
    (!cs24hWindowOpensAt || resolved.getTime() > cs24hWindowOpensAt.getTime())
  ) {
    void prisma.conversation
      .update({
        where: { id: conversationId },
        data: { cs24hWindowOpensAt: resolved },
      })
      .catch(() => {
        /* backfill is best-effort */
      });
  }

  return resolved;
}
