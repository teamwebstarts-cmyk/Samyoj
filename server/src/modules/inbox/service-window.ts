import prisma from '../../config/database';

/** Resolve when the customer service window opened (prefer stored field, else last inbound). */
export async function resolveCs24hWindowOpensAt(
  conversationId: string,
  cs24hWindowOpensAt: Date | null | undefined
): Promise<Date | null> {
  if (cs24hWindowOpensAt) return cs24hWindowOpensAt;

  const lastInbound = await prisma.message.findFirst({
    where: { conversationId, direction: 'INBOUND' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  if (!lastInbound?.createdAt) return null;

  void prisma.conversation
    .update({
      where: { id: conversationId },
      data: { cs24hWindowOpensAt: lastInbound.createdAt },
    })
    .catch(() => {
      /* backfill is best-effort */
    });

  return lastInbound.createdAt;
}
