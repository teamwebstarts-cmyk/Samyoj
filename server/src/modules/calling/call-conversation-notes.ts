import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';

export const conversationNotesInclude = {
  include: { user: { select: { id: true, name: true } } },
  orderBy: { createdAt: 'desc' as const },
};

export async function ensureConversationForCall(call: {
  id: string;
  organizationId: string;
  conversationId: string | null;
  contactId: string | null;
  whatsappNumberId: string | null;
}): Promise<{ id: string }> {
  if (call.conversationId) {
    const existing = await prisma.conversation.findFirst({
      where: { id: call.conversationId, organizationId: call.organizationId },
      select: { id: true },
    });
    if (existing) return existing;
  }

  if (!call.contactId || !call.whatsappNumberId) {
    throw new AppError(400, 'This call is not linked to a chat yet');
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      organizationId: call.organizationId,
      contactId: call.contactId,
      whatsappNumberId: call.whatsappNumberId,
    },
    select: { id: true },
    orderBy: { lastMessageAt: 'desc' },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        organizationId: call.organizationId,
        contactId: call.contactId,
        whatsappNumberId: call.whatsappNumberId,
        status: 'OPEN',
        botActive: true,
      },
      select: { id: true },
    });
  }

  if (call.conversationId !== conversation.id) {
    await prisma.call.update({
      where: { id: call.id },
      data: { conversationId: conversation.id },
    });
  }

  return conversation;
}

export async function migrateLegacyCallNotes(params: {
  callId: string;
  conversationId: string;
  userId: string;
  metadata: Prisma.JsonValue | null;
}): Promise<void> {
  const meta =
    params.metadata && typeof params.metadata === 'object' && !Array.isArray(params.metadata)
      ? { ...(params.metadata as Record<string, unknown>) }
      : {};
  const leftover = typeof meta.notes === 'string' ? meta.notes.trim() : '';
  if (!leftover) return;

  const dup = await prisma.internalNote.findFirst({
    where: { conversationId: params.conversationId, content: leftover },
    select: { id: true },
  });
  if (!dup) {
    await prisma.internalNote.create({
      data: {
        conversationId: params.conversationId,
        userId: params.userId,
        content: leftover,
      },
    });
  }

  delete meta.notes;
  await prisma.call.update({
    where: { id: params.callId },
    data: { metadata: meta as Prisma.InputJsonValue },
  });
}

export async function addInternalNoteToCall(params: {
  call: {
    id: string;
    organizationId: string;
    conversationId: string | null;
    contactId: string | null;
    whatsappNumberId: string | null;
    metadata: Prisma.JsonValue | null;
  };
  userId: string;
  content: string;
}) {
  const conversation = await ensureConversationForCall(params.call);
  await migrateLegacyCallNotes({
    callId: params.call.id,
    conversationId: conversation.id,
    userId: params.userId,
    metadata: params.call.metadata,
  });

  const note = await prisma.internalNote.create({
    data: {
      conversationId: conversation.id,
      userId: params.userId,
      content: params.content,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return { note, conversationId: conversation.id };
}

export async function loadCallInternalNotes(conversationId: string | null) {
  if (!conversationId) return [];
  return prisma.internalNote.findMany({
    where: { conversationId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}
