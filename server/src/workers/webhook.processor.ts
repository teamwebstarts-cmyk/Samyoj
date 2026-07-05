import { Prisma } from '@prisma/client';
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
  if (normalized === 'order') return 'INTERACTIVE';
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
        const metaMessageId = status.id as string;
        const statusValue = (status.status as string)?.toUpperCase();

        const existingMsg = await prisma.message.findFirst({
          where: { metaMessageId },
          select: { id: true, metadata: true },
        });

        const existingMeta = (existingMsg?.metadata as Record<string, unknown>) || {};
        const statusMeta: Record<string, unknown> = { ...existingMeta };
        if (status.pricing) statusMeta.pricing = status.pricing;
        if (status.errors) statusMeta.errors = status.errors;
        if (status.conversation) statusMeta.conversationId = (status.conversation as { id?: string })?.id;

        await prisma.message.updateMany({
          where: { metaMessageId },
          data: {
            status: statusValue as never,
            metadata: statusMeta as Prisma.InputJsonValue,
          },
        });

        const msg = await prisma.message.findFirst({
          where: { metaMessageId },
          include: { conversation: true },
        });

        if (msg) {
          emitToOrg(orgId, 'message:status', {
            messageId: msg.id,
            status: status.status,
            conversationId: msg.conversationId,
          });
        }

        const { syncCampaignRecipientFromWebhook } = await import('../modules/campaigns/service');
        await syncCampaignRecipientFromWebhook(metaMessageId, statusValue);
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
              source: 'INBOUND',
            },
          });
        } else if (contactName && !contact.name) {
          contact = await prisma.contact.update({
            where: { id: contact.id },
            data: { name: contactName },
          });
        }

        let conversation = await prisma.conversation.findFirst({
          where: { organizationId: orgId, contactId: contact.id, whatsappNumberId: whatsappNumber.id },
        });

        const isNew = !conversation;
        const { computeSlaDueAt } = await import('../modules/sla/service');
        const inboundTimestamp = msg.timestamp
          ? new Date(Number(msg.timestamp) * 1000)
          : new Date();

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              organizationId: orgId,
              contactId: contact.id,
              whatsappNumberId: whatsappNumber.id,
              lastMessageAt: inboundTimestamp,
              cs24hWindowOpensAt: inboundTimestamp,
              unreadCount: 1,
              slaDueAt: computeSlaDueAt(),
            },
          });
        } else {
          const updateData: Prisma.ConversationUpdateInput = {
            lastMessageAt: inboundTimestamp,
            cs24hWindowOpensAt: inboundTimestamp,
            unreadCount: { increment: 1 },
          };
          const existing = await prisma.conversation.findUnique({
            where: { id: conversation.id },
            select: { firstResponseAt: true, slaDueAt: true },
          });
          if (!existing?.firstResponseAt && !existing?.slaDueAt) {
            updateData.slaDueAt = computeSlaDueAt();
          }
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: updateData,
          });
        }

        const parsed = parseInboundMessage(msg);

        const inboundType = mapInboundMessageType(msg.type as string | undefined);
        const inboundMetadata = parsed.waFlowResponse
          ? { ...parsed.metadata, waFlowResponse: parsed.waFlowResponse, isWaFlowReply: true }
          : parsed.buttonReplyId
            ? { ...parsed.metadata, buttonReplyId: parsed.buttonReplyId, isButtonReply: true }
            : parsed.referral
              ? { ...parsed.metadata, referral: parsed.referral, isCtwaReferral: true }
              : parsed.orderPayload
                ? { ...parsed.metadata, orderPayload: parsed.orderPayload, isCatalogOrder: true }
                : parsed.metadata;

        let message = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            metaMessageId: msg.id as string,
            direction: 'INBOUND',
            type: inboundType,
            content: parsed.content,
            status: 'DELIVERED',
            metadata: inboundMetadata as Prisma.InputJsonValue,
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

        const { dispatchOrgWebhook } = await import('../modules/integrations/dispatch');

        if (parsed.orderPayload) {
          try {
            const { createOrderFromInbound } = await import('../modules/commerce/service');
            const items = parsed.orderPayload.productItems.map((item) => ({
              retailerId: item.product_retailer_id,
              name: item.product_retailer_id,
              quantity: item.quantity,
              amountCents: Math.round((item.item_price || 0) * 100),
            }));
            const subtotalCents = items.reduce(
              (sum, item) => sum + item.amountCents * item.quantity,
              0
            );
            const referenceId = `ord_${Date.now()}_${contact.id.slice(0, 8)}`;
            await createOrderFromInbound(orgId, {
              contactId: contact.id,
              conversationId: conversation.id,
              catalogId: parsed.orderPayload.catalogId,
              referenceId,
              items,
              amounts: {
                subtotalCents,
                taxCents: 0,
                shippingCents: 0,
                totalCents: subtotalCents,
                currency: parsed.orderPayload.productItems[0]?.currency || 'INR',
              },
              metadata: { inboundMessageId: message.id },
            });
          } catch (err) {
            logError(err, { source: 'webhook', action: 'Catalog order creation failed' });
          }
        }

        if (parsed.referral) {
          try {
            const existingConv = await prisma.conversation.findUnique({
              where: { id: conversation.id },
              select: { botState: true },
            });
            const priorState =
              existingConv?.botState && typeof existingConv.botState === 'object'
                ? (existingConv.botState as Record<string, unknown>)
                : {};

            await prisma.conversation.update({
              where: { id: conversation.id },
              data: {
                botState: {
                  ...priorState,
                  ctwaReferral: parsed.referral,
                  ctwaReceivedAt: new Date().toISOString(),
                } as Prisma.InputJsonValue,
              },
            });
            void dispatchOrgWebhook(orgId, 'referral.received', {
              conversationId: conversation.id,
              contactPhone,
              referral: parsed.referral,
            });
          } catch (err) {
            logError(err, { source: 'webhook', action: 'CTWA referral handling failed' });
          }
        }

        void dispatchOrgWebhook(orgId, 'message.received', {
          conversationId: conversation.id,
          messageId: message.id,
          contactPhone,
        });

        const msgType = (msg.type as string | undefined)?.toLowerCase() || 'text';
        const hasMedia = ['image', 'video', 'audio', 'document', 'sticker'].includes(msgType);

        const textContent = (content || '').trim();
        if (textContent && !hasMedia) {
          const { isOptOutMessage, isOptInMessage, handleOptOut, handleOptIn } = await import(
            '../modules/compliance/opt-out'
          );
          if (isOptOutMessage(textContent)) {
            await handleOptOut(orgId, contact.id, conversation.id, whatsappNumber.id);
            continue;
          }
          if (isOptInMessage(textContent)) {
            await handleOptIn(orgId, contact.id);
          }
        }

        await handleInboundAutomations({
          organizationId: orgId,
          conversationId: conversation.id,
          contactId: contact.id,
          messageId: message.id,
          contactPhone,
          phoneNumberId: whatsappNumber.phoneNumberId,
          encryptedToken: whatsappNumber.accessToken,
          content: content || '',
          buttonReplyId: parsed.buttonReplyId,
          isNewConversation: isNew,
          messageType: msgType,
          hasMedia,
          waFlowResponse: parsed.waFlowResponse,
        }).catch((err) =>
          logError(err, { source: 'webhook', action: 'Automation processing failed' })
        );
      }
    }
  }
}
