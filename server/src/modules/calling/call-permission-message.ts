import prisma from '../../config/database';
import { emitToOrg } from '../../realtime';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('call-permission-message');

/**
 * Persist an outbound call_permission_request as a visible message in the Inbox thread.
 * Idempotent via metaMessageId = `call-perm:<conversationId>:<contactId>:<ts>`.
 * The agent sees the permission request card in the conversation instead of only a toast.
 */
export async function publishCallPermissionMessage(input: {
  conversationId: string;
  organizationId: string;
  contactId: string;
  contactPhone: string;
  bodyText?: string;
  /** 'pending' | 'granted' | 'denied' — defaults to 'pending' for the initial request. */
  status?: string;
}): Promise<void> {
  const status = input.status || 'pending';
  const content =
    input.bodyText?.trim() ||
    'We would like to call you on WhatsApp to help with your request. Do you allow voice calls?';

  // Deduplicate: only one pending permission card per conversation+contact at a time.
  const existingPending = await prisma.message.findFirst({
    where: {
      conversationId: input.conversationId,
      direction: 'OUTBOUND',
      metadata: {
        path: ['callPermissionStatus'],
        equals: 'pending',
      },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (existingPending && status === 'pending') {
    log.info('Skipping duplicate call_permission_request — pending already exists', {
      conversationId: input.conversationId,
      contactId: input.contactId,
    });
    return;
  }

  const metaMessageId = `call-perm:${input.conversationId}:${input.contactId}:${Date.now()}`;

  try {
    const message = await prisma.message.create({
      data: {
        conversationId: input.conversationId,
        metaMessageId,
        direction: 'OUTBOUND',
        type: 'INTERACTIVE',
        content,
        status: 'READ',
        metadata: {
          callPermissionStatus: status,
          interactive: {
            mode: 'call_permission',
          },
        },
      },
    });

    await prisma.conversation.update({
      where: { id: input.conversationId },
      data: { lastMessageAt: message.createdAt },
    });
    const conversation = await prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: { whatsappNumberId: true },
    });

    emitToOrg(input.organizationId, 'message:new', {
      conversationId: input.conversationId,
      whatsappNumberId: conversation?.whatsappNumberId,
      message,
      conversation: {
        id: input.conversationId,
        lastMessageAt: message.createdAt,
        lastMessage: {
          id: message.id,
          direction: message.direction,
          type: message.type,
          content: message.content,
          status: message.status,
          createdAt: message.createdAt,
        },
      },
    });
  } catch (err) {
    log.warn('Failed to publish call permission message', {
      conversationId: input.conversationId,
      contactId: input.contactId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
