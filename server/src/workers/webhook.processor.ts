import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { MetaWhatsAppService } from '../modules/whatsapp/meta.service';
import { handleInboundAutomations } from '../modules/automation/engine';
import { parseInboundMessage } from '../modules/inbox/message-parser';
import { downloadAndStoreMessageMedia } from '../modules/media/download.service';
import { emitToOrg } from '../realtime';
import { logError } from '../errors';
import { createModuleLogger } from '../utils/logger';
import { parseMetaTimestamp } from '../modules/campaigns/safety';

const log = createModuleLogger('webhook');

function mapInboundMessageType(
  type: string | undefined
): 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'INTERACTIVE' | 'LOCATION' | 'CONTACTS' {
  const normalized = (type || 'text').toLowerCase();
  if (normalized === 'image' || normalized === 'sticker') return 'IMAGE';
  if (normalized === 'document') return 'DOCUMENT';
  if (normalized === 'audio' || normalized === 'voice') return 'AUDIO';
  if (normalized === 'video') return 'VIDEO';
  if (normalized === 'location') return 'LOCATION';
  if (normalized === 'contacts') return 'CONTACTS';
  if (normalized === 'order') return 'INTERACTIVE';
  if (['button', 'interactive', 'list', 'reaction'].includes(normalized)) {
    return 'INTERACTIVE';
  }
  // Meta "unsupported" (polls, edits, …) → TEXT bubble with isUnsupported metadata
  return 'TEXT';
}

export async function processWebhookPayload(payload: Record<string, unknown>) {
  const startTime = Date.now();

  if (payload.object !== 'whatsapp_business_account') return;

  for (const entry of (payload.entry as Array<Record<string, unknown>>) || []) {
    for (const change of (entry.changes as Array<Record<string, unknown>>) || []) {
      if (change.field !== 'messages') continue;

      const value = change.value as Record<string, unknown>;
      const metadata = value.metadata as { phone_number_id?: string } | undefined;
      const phoneNumberId = metadata?.phone_number_id;
      if (!phoneNumberId) continue;

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

      const totalMessages = (value.messages as unknown[])?.length || 0;
      const totalStatuses = (value.statuses as unknown[])?.length || 0;
      log.info('Webhook processing started', {
        organizationId: orgId,
        phoneNumberId,
        messageCount: totalMessages,
        statusCount: totalStatuses,
      });

      for (const status of (value.statuses as Array<Record<string, unknown>>) || []) {
        const metaMessageId = status.id as string;
        const statusValue = (status.status as string)?.toUpperCase();
        if (!statusValue) continue;
        const statusTimestamp = parseMetaTimestamp(status.timestamp);

        const STATUS_RANK: Record<string, number> = {
          PENDING: 0,
          SENT: 1,
          DELIVERED: 2,
          READ: 3,
          FAILED: 4,
        };

        const existingMsg = await prisma.message.findFirst({
          where: {
            metaMessageId,
            conversation: {
              organizationId: orgId,
              whatsappNumber: { phoneNumberId },
            },
          },
          select: { id: true, status: true, metadata: true },
        });
        const { syncCampaignRecipientFromWebhook } = await import('../modules/campaigns/service');
        await syncCampaignRecipientFromWebhook(metaMessageId, statusValue, {
          organizationId: orgId,
          phoneNumberId,
          timestamp: statusTimestamp,
          errors: status.errors,
        });
        if (!existingMsg) continue;

        const existingMeta = (existingMsg.metadata as Record<string, unknown>) || {};
        const parsedExistingStatusAt = typeof existingMeta.providerStatusAt === 'string'
          ? new Date(existingMeta.providerStatusAt)
          : null;
        const existingStatusAt = parsedExistingStatusAt && !Number.isNaN(parsedExistingStatusAt.getTime())
          ? parsedExistingStatusAt
          : null;
        const hasValidEventTime = Boolean(statusTimestamp && !Number.isNaN(statusTimestamp.getTime()));
        const isOlderOrDuplicate = Boolean(
          hasValidEventTime &&
          existingStatusAt &&
          statusTimestamp!.getTime() <= existingStatusAt.getTime()
        );
        const currentRank = STATUS_RANK[existingMsg.status] ?? -1;
        const nextRank = STATUS_RANK[statusValue] ?? -1;
        // Don't regress ticks (e.g. sent after read). FAILED can replace a
        // milestone only when Meta supplied a newer event timestamp.
        const shouldUpdateStatus =
          !isOlderOrDuplicate &&
          (statusValue === 'FAILED'
            ? (!existingStatusAt || hasValidEventTime)
            : nextRank >= currentRank);

        const statusMeta: Record<string, unknown> = { ...existingMeta };
        if (!isOlderOrDuplicate && status.pricing) statusMeta.pricing = status.pricing;
        if (!isOlderOrDuplicate && status.errors) statusMeta.errors = status.errors;
        if (!isOlderOrDuplicate && status.conversation) {
          statusMeta.conversationId = (status.conversation as { id?: string })?.id;
        }
        if (hasValidEventTime && !isOlderOrDuplicate) {
          statusMeta.providerStatusAt = statusTimestamp!.toISOString();
          statusMeta.providerEventKey = `${metaMessageId}:${statusValue}:${statusTimestamp!.toISOString()}`;
        }

        await prisma.message.updateMany({
          where: {
            metaMessageId,
            conversation: {
              organizationId: orgId,
              whatsappNumber: { phoneNumberId },
            },
          },
          data: {
            ...(shouldUpdateStatus ? { status: statusValue as never } : {}),
            metadata: statusMeta as Prisma.InputJsonValue,
          },
        });

        const msg = await prisma.message.findFirst({
          where: {
            metaMessageId,
            conversation: {
              organizationId: orgId,
              whatsappNumber: { phoneNumberId },
            },
          },
          include: { conversation: true },
        });

        if (msg && shouldUpdateStatus) {
          log.info('Message status updated', {
            messageId: msg.id,
            metaMessageId,
            status: statusValue,
            organizationId: orgId,
          });
          emitToOrg(orgId, 'message:status', {
            messageId: msg.id,
            status: statusValue,
            conversationId: msg.conversationId,
          });
        }

      }

      for (const msg of (value.messages as Array<Record<string, unknown>>) || []) {
        const startMsgTime = Date.now();
        const metaMessageId = msg.id as string;
        const messageType = msg.type as string;
        const contactPhone = msg.from as string;
        if (!metaMessageId || !contactPhone) continue;
        const inboundTimestamp = parseMetaTimestamp(msg.timestamp);
        if (!inboundTimestamp) {
          log.warn('Inbound message rejected without a valid Meta timestamp', {
            metaMessageId,
            organizationId: orgId,
          });
          continue;
        }
        const contacts = (value.contacts as Array<{ wa_id?: string; profile?: { name?: string } }>) || [];
        const contactEntry = contacts.find((c) => c.wa_id === contactPhone);
        const contactName = contactEntry?.profile?.name;

        log.info('Processing inbound message', {
          metaMessageId,
          messageType,
          contactPhone,
          organizationId: orgId,
          phoneNumberId,
        });

        const parsed = parseInboundMessage(msg);
        if (parsed.reaction) {
          const target = await prisma.message.findFirst({
            where: {
              metaMessageId: parsed.reaction.messageId,
              conversation: { organizationId: orgId, whatsappNumberId: whatsappNumber.id },
            },
          });
          if (target) {
            const targetMetadata = (target.metadata as Record<string, unknown>) || {};
            const existingReactions = Array.isArray(targetMetadata.reactions)
              ? (targetMetadata.reactions as Array<Record<string, unknown>>)
              : [];
            const from = contactPhone || 'customer';
            const reactions = existingReactions.filter((reaction) => reaction.from !== from);
            if (parsed.reaction.emoji) {
              reactions.push({ emoji: parsed.reaction.emoji, from });
            }
            const updated = await prisma.message.update({
              where: { id: target.id },
              data: {
                metadata: { ...targetMetadata, reactions } as Prisma.InputJsonValue,
              },
            });
            emitToOrg(orgId, 'message:reaction', {
              conversationId: target.conversationId,
              messageId: target.id,
              reactions,
              metadata: updated.metadata,
            });
          }
          continue;
        }

        let contact = await prisma.contact.upsert({
          where: { organizationId_phone: { organizationId: orgId, phone: contactPhone } },
          create: {
            organizationId: orgId,
            phone: contactPhone,
            name: contactName,
            optedIn: true,
            source: 'INBOUND',
          },
          update: contactName ? { name: contactName } : {},
        });

        const priorConversation = await prisma.conversation.findUnique({
          where: {
            organizationId_contactId_whatsappNumberId: {
              organizationId: orgId,
              contactId: contact.id,
              whatsappNumberId: whatsappNumber.id,
            },
          },
        });
        let conversation = await prisma.conversation.upsert({
          where: {
            organizationId_contactId_whatsappNumberId: {
              organizationId: orgId,
              contactId: contact.id,
              whatsappNumberId: whatsappNumber.id,
            },
          },
          create: {
            organizationId: orgId,
            contactId: contact.id,
            whatsappNumberId: whatsappNumber.id,
          },
          update: {},
        });

        const isNew = !priorConversation;
        const { computeSlaDueAt } = await import('../modules/sla/service');

        const inboundType = mapInboundMessageType(msg.type as string | undefined);
        let inboundMetadata: Record<string, unknown> | undefined = parsed.waFlowResponse
          ? { ...(parsed.metadata as Record<string, unknown> | undefined), waFlowResponse: parsed.waFlowResponse, isWaFlowReply: true }
          : parsed.buttonReplyId
            ? { ...(parsed.metadata as Record<string, unknown> | undefined), buttonReplyId: parsed.buttonReplyId, isButtonReply: true }
            : parsed.referral
              ? { ...(parsed.metadata as Record<string, unknown> | undefined), referral: parsed.referral, isCtwaReferral: true }
              : parsed.orderPayload
                ? { ...(parsed.metadata as Record<string, unknown> | undefined), orderPayload: parsed.orderPayload, isCatalogOrder: true }
                : parsed.metadata
                  ? { ...(parsed.metadata as Record<string, unknown>) }
                  : undefined;

        if (parsed.location) {
          inboundMetadata = { ...(inboundMetadata || {}), location: parsed.location };
        }
        if (parsed.contacts?.length) {
          inboundMetadata = { ...(inboundMetadata || {}), contacts: parsed.contacts };
        }

        if (parsed.replyToMetaId) {
          const replyTarget = await prisma.message.findFirst({
            where: {
              conversationId: conversation.id,
              metaMessageId: parsed.replyToMetaId,
            },
            select: { id: true, content: true },
          });
          inboundMetadata = {
            ...(inboundMetadata || {}),
            replyToMetaId: parsed.replyToMetaId,
            ...(replyTarget
              ? {
                  replyToMessageId: replyTarget.id,
                  replyPreview: replyTarget.content.slice(0, 160),
                }
              : {}),
          };
        }

        let message;
        try {
          message = await prisma.message.create({
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
        } catch (err) {
          // Meta may retry the same webhook; metaMessageId is unique.
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            log.info('Duplicate inbound message skipped (Meta retry)', {
              metaMessageId,
              organizationId: orgId,
            });
            continue;
          }
          throw err;
        }

        // The unique metaMessageId insert is the commit point. Only its winner
        // may mutate unread/timestamps/SLA state, so concurrent Meta retries
        // cannot double-apply conversation side effects.
        const updateData: Prisma.ConversationUpdateInput = {
          lastMessageAt: inboundTimestamp,
          cs24hWindowOpensAt: inboundTimestamp,
          unreadCount: { increment: 1 },
        };
        const conversationState = await prisma.conversation.findUnique({
          where: { id: conversation.id },
          select: { firstResponseAt: true, slaDueAt: true },
        });
        if (!conversationState?.firstResponseAt && !conversationState?.slaDueAt) {
          updateData.slaDueAt = computeSlaDueAt();
        }
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: updateData,
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
              isSticker: Boolean((inboundMetadata as { isSticker?: boolean } | null)?.isSticker),
              isGif: Boolean((inboundMetadata as { isGif?: boolean } | null)?.isGif),
            });
            message = await prisma.message.update({
              where: { id: message.id },
              data: {
                metadata: {
                  ...(inboundMetadata || {}),
                  ...stored,
                },
              },
            });
          } catch (err) {
            logError(err, {
              source: 'webhook',
              action: 'Inbound media download failed',
              messageId: message.id,
              organizationId: orgId,
            });
          }
        }

        const content = parsed.content;

        log.info('Saved inbound message', {
          messageId: message.id,
          metaMessageId,
          contactPhone,
          organizationId: orgId,
          conversationId: conversation.id,
          messageType: inboundType,
          hasMedia: Boolean(parsed.metadata?.mediaId),
          processingTimeMs: Date.now() - startMsgTime,
        });

        const conversationSummary = await prisma.conversation.findUnique({
          where: { id: conversation.id },
          select: { id: true, lastMessageAt: true, unreadCount: true },
        });

        emitToOrg(orgId, 'message:new', {
          conversationId: conversation.id,
          message,
          contact,
          conversation: conversationSummary
            ? {
                ...conversationSummary,
                lastMessage: {
                  id: message.id,
                  direction: message.direction,
                  type: message.type,
                  content: message.content,
                  status: message.status,
                  createdAt: message.createdAt,
                },
              }
            : undefined,
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
            logError(err, {
              source: 'webhook',
              action: 'Catalog order creation failed',
              messageId: message.id,
              organizationId: orgId,
            });
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
            logError(err, {
              source: 'webhook',
              action: 'CTWA referral handling failed',
              messageId: message.id,
              organizationId: orgId,
            });
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
            log.info('Opt-out detected in inbound message', {
              messageId: message.id,
              organizationId: orgId,
              contactPhone,
            });
            await handleOptOut(orgId, contact.id, conversation.id, whatsappNumber.id, inboundTimestamp, metaMessageId);
            continue;
          }
          if (isOptInMessage(textContent)) {
            await handleOptIn(orgId, contact.id, inboundTimestamp, metaMessageId);
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
          logError(err, {
            source: 'webhook',
            action: 'Automation processing failed',
            messageId: message.id,
            organizationId: orgId,
          })
        );

        log.info('Inbound message processing complete', {
          messageId: message.id,
          metaMessageId,
          conversationId: conversation.id,
          isNewConversation: isNew,
          totalTimeMs: Date.now() - startMsgTime,
        });
      }

      log.info('Webhook processing complete', {
        organizationId: orgId,
        totalTimeMs: Date.now() - startTime,
      });
    }
  }
}