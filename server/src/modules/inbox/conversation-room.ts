import prisma from '../../config/database';
import { resolveActiveWhatsappNumberId, scopedConversationWhere } from '../whatsapp/active-number';

export function parseConversationJoinPayload(payload: unknown): {
  conversationId: string;
  whatsappNumberId?: string;
} | null {
  if (typeof payload === 'string' && payload.trim()) {
    return { conversationId: payload.trim() };
  }
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as { conversationId?: unknown; whatsappNumberId?: unknown };
  if (typeof body.conversationId !== 'string' || !body.conversationId.trim()) return null;
  return {
    conversationId: body.conversationId.trim(),
    whatsappNumberId:
      typeof body.whatsappNumberId === 'string' && body.whatsappNumberId.trim()
        ? body.whatsappNumberId.trim()
        : undefined,
  };
}

export async function conversationRoomAllowed(
  conversationId: string,
  organizationId: string,
  whatsappNumberId: string | undefined
): Promise<boolean> {
  if (!conversationId || !organizationId || !whatsappNumberId) return false;
  const conversation = await prisma.conversation.findFirst({
    where: scopedConversationWhere(organizationId, conversationId, whatsappNumberId),
    select: { id: true },
  });
  return Boolean(conversation);
}

export async function resolveSocketWhatsappNumberId(
  organizationId: string,
  requested: string | undefined
): Promise<string | undefined> {
  try {
    return await resolveActiveWhatsappNumberId(organizationId, requested);
  } catch {
    return undefined;
  }
}
