import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import type { Prisma } from '@prisma/client';

export const WA_NUMBER_HEADER = 'x-whatsapp-number-id';

declare global {
  namespace Express {
    interface Request {
      activeWhatsappNumberId?: string;
    }
  }
}

export async function resolveActiveWhatsappNumberId(
  organizationId: string,
  headerValue?: string | string[]
): Promise<string | undefined> {
  const requested = typeof headerValue === 'string' ? headerValue.trim() : undefined;

  if (requested) {
    const found = await prisma.whatsappNumber.findFirst({
      where: { id: requested, organizationId, isActive: true },
      select: { id: true },
    });
    if (!found) {
      throw new AppError(400, 'Selected WhatsApp number is not available.');
    }
    return found.id;
  }

  const fallback = await prisma.whatsappNumber.findFirst({
    where: { organizationId, isActive: true },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  return fallback?.id;
}

/** Attach active WhatsApp number from request header (validated against org). */
export async function resolveActiveWhatsappNumber(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    if (!req.user?.organizationId) return next();
    req.activeWhatsappNumberId = await resolveActiveWhatsappNumberId(
      req.user.organizationId,
      req.headers[WA_NUMBER_HEADER]
    );
    next();
  } catch (err) {
    next(err);
  }
}

/** Match nothing — used when no WhatsApp number is connected (never leak org-wide data). */
const EMPTY_ID_FILTER = { id: { in: [] as string[] } } as const;

/**
 * Scope conversations to the active connected number.
 * When disconnected (`numberId` missing), return an empty match — do NOT fall back to all org rows.
 */
export function conversationFilter(numberId: string | undefined): Prisma.ConversationWhereInput {
  if (!numberId) return EMPTY_ID_FILTER;
  return { whatsappNumberId: numberId };
}

export function contactsForNumberFilter(numberId: string | undefined): Prisma.ContactWhereInput {
  if (!numberId) return EMPTY_ID_FILTER;
  return { whatsappNumberId: numberId };
}

export function leadsForNumberFilter(numberId: string | undefined): Prisma.LeadWhereInput {
  if (!numberId) return EMPTY_ID_FILTER;
  return { whatsappNumberId: numberId };
}

export function ticketsForNumberFilter(numberId: string | undefined): Prisma.TicketWhereInput {
  if (!numberId) return EMPTY_ID_FILTER;
  return {
    OR: [
      { conversation: { whatsappNumberId: numberId } },
      {
        conversationId: null,
        contact: { conversations: { some: { whatsappNumberId: numberId } } },
      },
    ],
  };
}

export function ordersForNumberFilter(numberId: string | undefined): Prisma.OrderWhereInput {
  if (!numberId) return EMPTY_ID_FILTER;
  return { whatsappNumberId: numberId };
}

export function messagesForNumberFilter(numberId: string | undefined): Prisma.MessageWhereInput {
  if (!numberId) return EMPTY_ID_FILTER;
  return { conversation: { whatsappNumberId: numberId } };
}

/**
 * Single-conversation lookups must use the same number scope as the list.
 * No active number → match nothing (disconnected Inbox stays blank even by id).
 */
export function scopedConversationWhere(
  organizationId: string,
  conversationId: string,
  activeWhatsappNumberId: string | undefined
): Prisma.ConversationWhereInput {
  if (!activeWhatsappNumberId) {
    return { organizationId, ...EMPTY_ID_FILTER };
  }
  return {
    id: conversationId,
    organizationId,
    whatsappNumberId: activeWhatsappNumberId,
  };
}

/** Scope nested `conversation: { … }` filters (media, retry, notes). */
export function scopedConversationParent(
  organizationId: string,
  activeWhatsappNumberId: string | undefined
): Prisma.ConversationWhereInput {
  if (!activeWhatsappNumberId) {
    return { organizationId, ...EMPTY_ID_FILTER };
  }
  return {
    organizationId,
    whatsappNumberId: activeWhatsappNumberId,
  };
}
