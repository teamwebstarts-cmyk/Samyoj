import prisma from '../../config/database';
import { emitToOrg } from '../../realtime';
import { createModuleLogger } from '../../utils/logger';
import { CUSTOMER_SERVICE_WINDOW_MS } from '../inbox/service-window';
import { computeSlaDueAt } from '../sla/service';

const log = createModuleLogger('facebook-messenger-ingest');

/** Placeholder phone so Contact.phone stays required without inventing a dialable WA number. */
export function messengerContactPhone(psid: string): string {
  return `messenger:${psid}`;
}

export function messengerWindowOpen(cs24hWindowOpensAt: Date | null | undefined, now = new Date()): boolean {
  if (!cs24hWindowOpensAt) return false;
  return now.getTime() - cs24hWindowOpensAt.getTime() < CUSTOMER_SERVICE_WINDOW_MS;
}

export type IngestMessengerResult = {
  conversationId: string;
  messageId: string | null;
  contactId: string;
  createdConversation: boolean;
  skippedReason?: string;
};

type InboundMessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

/**
 * Map PSID → ContactPlatformIdentity + channelId-scoped Conversation.
 * Never sets whatsappNumberId. Never creates a Lead.
 */
export async function ingestMessengerTextMessage(opts: {
  organizationId: string;
  channelId: string;
  psid: string;
  text: string;
  metaMessageId?: string;
  timestampMs?: number;
  messageType?: InboundMessageType;
  metadata?: unknown;
}): Promise<IngestMessengerResult> {
  const psid = opts.psid.trim();
  if (!psid) {
    return {
      conversationId: '',
      messageId: null,
      contactId: '',
      createdConversation: false,
      skippedReason: 'missing_psid',
    };
  }

  const phone = messengerContactPhone(psid);
  const receivedAt =
    opts.timestampMs && Number.isFinite(opts.timestampMs)
      ? new Date(opts.timestampMs)
      : new Date();

  let identity = await prisma.contactPlatformIdentity.findUnique({
    where: {
      organizationId_platform_externalId: {
        organizationId: opts.organizationId,
        platform: 'FB',
        externalId: psid,
      },
    },
    select: { contactId: true },
  });

  let contactId = identity?.contactId;
  if (!contactId) {
    const contact = await prisma.contact.create({
      data: {
        organizationId: opts.organizationId,
        phone,
        normalizedPhone: phone,
        name: `Messenger ${psid.slice(-6)}`,
        source: 'INBOUND',
        whatsappNumberId: null,
      },
      select: { id: true },
    });
    contactId = contact.id;
    try {
      await prisma.contactPlatformIdentity.create({
        data: {
          organizationId: opts.organizationId,
          contactId,
          platform: 'FB',
          externalId: psid,
        },
      });
    } catch (err) {
      // Race: another webhook created the identity — reuse theirs.
      const raced = await prisma.contactPlatformIdentity.findUnique({
        where: {
          organizationId_platform_externalId: {
            organizationId: opts.organizationId,
            platform: 'FB',
            externalId: psid,
          },
        },
        select: { contactId: true },
      });
      if (!raced) throw err;
      contactId = raced.contactId;
      // The Contact this request just created lost the identity race and has no conversation
      // or message yet, so it would be an orphan forever (S-05 step 1 / G-05).
      try {
        await prisma.contact.delete({ where: { id: contact.id } });
      } catch (cleanupErr) {
        log.warn('Messenger orphan contact cleanup failed', {
          organizationId: opts.organizationId,
          contactId: contact.id,
          error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        });
      }
    }
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      organizationId: opts.organizationId,
      channelId: opts.channelId,
      contactId,
      whatsappNumberId: null,
    },
    select: { id: true, unreadCount: true },
  });

  let createdConversation = false;
  if (!conversation) {
    try {
      conversation = await prisma.conversation.create({
        data: {
          organizationId: opts.organizationId,
          channelId: opts.channelId,
          contactId,
          whatsappNumberId: null,
          status: 'OPEN',
          lastMessageAt: receivedAt,
          cs24hWindowOpensAt: receivedAt,
          slaDueAt: computeSlaDueAt(receivedAt),
          unreadCount: 1,
        },
        select: { id: true, unreadCount: true },
      });
      createdConversation = true;
    } catch (err) {
      const raced = await prisma.conversation.findFirst({
        where: {
          organizationId: opts.organizationId,
          channelId: opts.channelId,
          contactId,
          whatsappNumberId: null,
        },
        select: { id: true, unreadCount: true },
      });
      if (!raced) throw err;
      conversation = raced;
    }
  }

  if (opts.metaMessageId) {
    // The global unique index on metaMessageId is the real dedupe key — Meta mids are unique.
    // Assert the match belongs to this conversation rather than silently returning a foreign
    // conversation id (S-07 / G-07).
    const existingMsg = await prisma.message.findUnique({
      where: { metaMessageId: opts.metaMessageId },
      select: { id: true, conversationId: true },
    });
    if (existingMsg) {
      if (existingMsg.conversationId !== conversation.id) {
        log.warn('Messenger message id already stored in another conversation', {
          organizationId: opts.organizationId,
          channelId: opts.channelId,
          metaMessageId: opts.metaMessageId,
          conversationId: conversation.id,
          existingConversationId: existingMsg.conversationId,
        });
      }
      return {
        conversationId: existingMsg.conversationId,
        messageId: existingMsg.id,
        contactId,
        createdConversation: false,
        skippedReason: 'duplicate_mid',
      };
    }
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      metaMessageId: opts.metaMessageId || undefined,
      direction: 'INBOUND',
      type: opts.messageType || 'TEXT',
      content: opts.text,
      status: 'DELIVERED',
      metadata: opts.metadata as object | undefined,
      createdAt: receivedAt,
    },
  });

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: receivedAt,
      cs24hWindowOpensAt: receivedAt,
      unreadCount: createdConversation ? 1 : { increment: 1 },
      status: 'OPEN',
    },
    select: { id: true, lastMessageAt: true, unreadCount: true, channelId: true },
  });

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, name: true, phone: true },
  });

  emitToOrg(opts.organizationId, 'message:new', {
    conversationId: conversation.id,
    channelId: opts.channelId,
    platform: 'FB',
    message,
    contact,
    conversation: updated,
  });

  log.info('Messenger inbound stored', {
    organizationId: opts.organizationId,
    channelId: opts.channelId,
    conversationId: conversation.id,
    messageId: message.id,
    createdConversation,
  });

  return {
    conversationId: conversation.id,
    messageId: message.id,
    contactId,
    createdConversation,
  };
}
