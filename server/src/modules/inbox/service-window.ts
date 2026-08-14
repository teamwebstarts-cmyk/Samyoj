import prisma from '../../config/database';

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
  cs24hWindowOpensAt: Date | null | undefined
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
