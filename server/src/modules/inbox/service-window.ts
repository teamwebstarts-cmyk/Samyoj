import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';

export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function serviceWindowOpenSince(now = new Date()): Date {
  return new Date(now.getTime() - CUSTOMER_SERVICE_WINDOW_MS);
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
  if (kind === 'open') {
    return { cs24hWindowOpensAt: { gte: since } };
  }
  return {
    OR: [{ cs24hWindowOpensAt: null }, { cs24hWindowOpensAt: { lt: since } }],
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
