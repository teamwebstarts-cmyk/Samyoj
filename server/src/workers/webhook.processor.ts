import prisma from '../config/database';
import { MetaWhatsAppService } from '../modules/whatsapp/meta.service';
import { handleInboundAutomations } from '../modules/automation/engine';
import { parseInboundMessage } from '../modules/inbox/message-parser';
import { downloadAndStoreMessageMedia } from '../modules/media/download.service';
import { emitToOrg } from '../realtime';
import { logError } from '../errors';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('webhook');

function mapInboundMessageType(type: string | undefined): 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'INTERACTIVE' {
  const normalized = (type || 'text').toLowerCase();
  if (normalized === 'image' || normalized === 'sticker') return 'IMAGE';
  if (normalized === 'document') return 'DOCUMENT';
  if (normalized === 'audio' || normalized === 'voice') return 'AUDIO';
  if (normalized === 'video') return 'VIDEO';
  if (
    ['button', 'interactive', 'list', 'reaction', 'sticker', 'location', 'contacts'].includes(
      normalized
    )
  ) {
    return 'INTERACTIVE';
  }
  return 'TEXT';
}

export async function processWebhookPayload(payload: Record<string, unknown>) {
  if (payload.object !== 'whatsapp_business_account') return;

  for (const entry of (payload.entry as Array<Record<string, unknown>>) || []) {
    for (const change of (entry.changes as Array<Record<string, unknown>>) || []) {
      if (change.field !== 'messages') continue;

      const value = change.value as Record<string, unknown>;
      const metadata = value.metadata as { phone_number_id?: string } | undefined;
      const phoneNumberId = metadata?.phone_number_id;

      const whatsappNumber = await prisma.whatsappNumber.findFirst({
        where: { phoneNumberId, isActive: true },
      });
      if (!whatsappNumber) {
        log.warn('No active WhatsApp number for inbound webhook', {
          phoneNumberId,
        });
        continue;
      }

      const orgId = whatsappNumber.organizationId;

      for (const status of (value.statuses as Array<Record<string, unknown>>) || []) {
        await prisma.message.updateMany({
          where: { metaMessageId: status.id as string },
          data: { status: (status.status as string)?.toUpperCase() as never },
        });

        const msg = await prisma.message.findFirst({
          where: { metaMessageId: status.id as string },
          include: { conversation: true },
        });

        if (msg) {
          emitToOrg(orgId, 'message:status', {
            messageId: msg.id,
            status: status.status,
            conversationId: msg.conversationId,
          });
        }
      }

      for (const msg of (value.messages as Array<Record<string, unknown>>) || []) {
        const contactPhone = msg.from as string;
        const contacts = (value.contacts as Array<{ wa_id?: string; profile?: { name?: string } }>) || [];
        const contactEntry = contacts.find((c) => c.wa_id === contactPhone);
        const contactName = contactEntry?.profile?.name;

        let contact = await prisma.contact.findUnique({
          where: {
            organizationId_phone: { organizationId: orgId, phone: contactPhone },
          },
        });

        if (!contact) {
          contact = await prisma.contact.create({
            data: {
              organizationId: orgId,
              phone: contactPhone,
              name: contactName,
              optedIn: true,
            },
          });
        } else if (contactName && !contact.name) {
          contact = await prisma.contact.update({
            where: { id: contact.id },
            data: { name: contactName },
          });
        }

        let conversation = await prisma.conversation.findFirst({
          where: { organizationId: orgId, contactId: contact.id },
        });

        const isNew = !conversation;
        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              organizationId: orgId,
              contactId: contact.id,
              whatsappNumberId: whatsappNumber.id,
              lastMessageAt: new Date(),
              unreadCount: 1,
            },
          });
        } else {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              lastMessageAt: new Date(),
              unreadCount: { increment: 1 },
            },
          });
        }

        const parsed = parseInboundMessage(msg);

        let message = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            metaMessageId: msg.id as string,
            direction: 'INBOUND',
            type: mapInboundMessageType(msg.type as string | undefined),
            content: parsed.content,
            status: 'DELIVERED',
            metadata: parsed.metadata,
          },
        });

        if (parsed.metadata?.mediaId) {
          try {
            const accessToken = MetaWhatsAppService.decryptToken(whatsappNumber.accessToken);
            const stored = await downloadAndStoreMessageMedia({
              organizationId: orgId,
              messageId: message.id,
              mediaId: parsed.metadata.mediaId,
              mimeType: parsed.metadata.mimeType,
              filename: parsed.metadata.filename,
              accessToken,
            });
            message = await prisma.message.update({
              where: { id: message.id },
              data: {
                metadata: {
                  ...parsed.metadata,
                  ...stored,
                },
              },
            });
          } catch (err) {
            logError(err, {
              source: 'webhook',
              action: 'Inbound media download failed',
              messageId: message.id,
            });
          }
        }

        const content = parsed.content;

        log.info('Saved inbound message', {
          messageId: message.id,
          contactPhone,
          organizationId: orgId,
        });

        emitToOrg(orgId, 'message:new', {
          conversationId: conversation.id,
          message,
          contact,
        });

        await handleInboundAutomations({
          organizationId: orgId,
          conversationId: conversation.id,
          messageId: message.id,
          contactPhone,
          phoneNumberId: whatsappNumber.phoneNumberId,
          encryptedToken: whatsappNumber.accessToken,
          content: content || '',
          isNewConversation: isNew,
        }).catch((err) =>
          logError(err, { source: 'webhook', action: 'Automation processing failed' })
        );
      }
    }
  }
}
