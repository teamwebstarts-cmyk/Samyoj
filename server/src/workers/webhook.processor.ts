import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { MetaWhatsAppService } from '../modules/whatsapp/meta.service';
import { handleInboundAutomations } from '../modules/automation/engine';
import { parseInboundMessage, type ParsedInboundMessage } from '../modules/inbox/message-parser';
import { downloadAndStoreMessageMedia } from '../modules/media/download.service';
import { emitToOrg } from '../realtime';
import { logError } from '../errors';
import { createModuleLogger } from '../utils/logger';
import { parseMetaTimestamp } from '../modules/campaigns/safety';
import { normalizePhoneIdentity } from '../utils/phone';
import { handleOutboundStatusWebhook } from '../modules/whatsapp/provider-status';
import {
  inboundConversationRepairWhere,
  inboundConversationSideEffectData,
  needsInboundConversationRepair,
} from '../modules/whatsapp/inbound-side-effects';
import {
  inboundReplyConsentFields,
  shouldGrantInboundReplyConsent,
} from '../modules/contacts/consent';
import { emitProductEvent } from '../modules/platform/events';
import { NEW_CONTACT_CALLING_DEFAULTS } from '../modules/contacts/contact-ai-defaults';
import { NEW_CONVERSATION_CHAT_DEFAULTS, applyGlobalChatToConversation } from '../modules/chat/chat-settings.service';
import { applyGlobalCallingToContactIfEnabled } from '../modules/calling/calling-ai-global.service';
import { checkQuota } from '../modules/billing/entitlements.service';
import { flowQueue } from '../config/queues';

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

type InboundFollowupMessage = {
  id: string;
  conversationId: string;
  direction: string;
  type: string;
  content: string | null;
  createdAt: Date;
  status: string;
  metadata: Prisma.JsonValue | null;
};

async function applyInboundMessageFollowups(params: {
  orgId: string;
  whatsappNumber: { id: string; accessToken: string };
  conversation: { id: string };
  contact: { id: string };
  message: InboundFollowupMessage;
  parsed: ParsedInboundMessage;
  inboundMetadata: Record<string, unknown> | undefined;
  contactPhone: string;
  inboundTimestamp: Date;
  metaMessageId: string;
  isNew: boolean;
  msgType: string;
  startMsgTime: number;
}): Promise<void> {
  const {
    orgId,
    whatsappNumber,
    conversation,
    contact,
    parsed,
    inboundMetadata,
    contactPhone,
    inboundTimestamp,
    metaMessageId,
    isNew,
    msgType,
    startMsgTime,
  } = params;
  let message = params.message;
  const storedMeta = (message.metadata as Record<string, unknown> | null) || {};

  if (parsed.metadata?.mediaId && !storedMeta.mediaPath) {
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
            ...storedMeta,
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
    messageType: mapInboundMessageType(msgType),
    hasMedia: Boolean(parsed.metadata?.mediaId),
    processingTimeMs: Date.now() - startMsgTime,
  });

  const conversationSummary = await prisma.conversation.findUnique({
    where: { id: conversation.id },
    select: { id: true, lastMessageAt: true, unreadCount: true },
  });

  emitToOrg(orgId, 'message:new', {
    conversationId: conversation.id,
    whatsappNumberId: whatsappNumber.id,
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

  if (parsed.orderPayload && !storedMeta.orderId) {
    try {
      const { createOrderFromInbound } = await import('../modules/commerce/service');
      const items = parsed.orderPayload.productItems.map((item) => ({
        retailerId: item.product_retailer_id,
        name: item.product_retailer_id,
        quantity: item.quantity,
        amountCents: Math.round((item.item_price || 0) * 100),
      }));
      const subtotalCents = items.reduce((sum, item) => sum + item.amountCents * item.quantity, 0);
      const referenceId = `ord_msg_${message.id}`;
      const order = await createOrderFromInbound(orgId, {
        contactId: contact.id,
        conversationId: conversation.id,
        whatsappNumberId: whatsappNumber.id,
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
      await prisma.message.update({
        where: { id: message.id },
        data: {
          metadata: {
            ...((message.metadata as Record<string, unknown> | null) || {}),
            orderId: order.id,
          },
        },
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
      if (!priorState.ctwaReferral) {
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
      }
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
      return;
    }
    if (isOptInMessage(textContent)) {
      await handleOptIn(orgId, contact.id, inboundTimestamp, metaMessageId, whatsappNumber.id);
    }
  }

  try {
    await handleInboundAutomations({
      organizationId: orgId,
      conversationId: conversation.id,
      contactId: contact.id,
      messageId: message.id,
      contactPhone,
      whatsappNumberId: whatsappNumber.id,
      content: content || '',
      buttonReplyId: parsed.buttonReplyId,
      isNewConversation: isNew,
      messageType: msgType,
      hasMedia,
      waFlowResponse: parsed.waFlowResponse,
    });
  } catch (err) {
    logError(err, {
      source: 'webhook',
      action: 'Automation processing failed; queued durable retry',
      messageId: message.id,
      organizationId: orgId,
    });
    const retryJobId = `inbound-automation-${message.id}`;
    try {
      const existingRetry = await flowQueue.getJob(retryJobId);
      if (!existingRetry) {
        await flowQueue.add(
          'retry-inbound-message',
          {
            organizationId: orgId,
            conversationId: conversation.id,
            contactId: contact.id,
            messageId: message.id,
            whatsappNumberId: whatsappNumber.id,
            isNewConversation: isNew,
          },
          {
            jobId: retryJobId,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: 200,
            removeOnFail: 500,
          }
        );
      }
    } catch (queueError) {
      logError(queueError, {
        source: 'webhook',
        action: 'Could not queue automation retry',
        messageId: message.id,
        organizationId: orgId,
      });
    }
  }

  log.info('Inbound message processing complete', {
    messageId: message.id,
    metaMessageId,
    conversationId: conversation.id,
    isNewConversation: isNew,
    totalTimeMs: Date.now() - startMsgTime,
  });
}

export async function processWebhookPayload(
  payload: Record<string, unknown>,
  _context?: { whatsappNumberId?: string }
) {
  const startTime = Date.now();

  // Page / IG objects never create WhatsApp conversations. Page leadgen claim lives in dispatcher.
  if (payload.object !== 'whatsapp_business_account') return;

  for (const entry of (payload.entry as Array<Record<string, unknown>>) || []) {
    for (const change of (entry.changes as Array<Record<string, unknown>>) || []) {
      if (change.field !== 'messages') continue;

      const value = change.value as Record<string, unknown>;
      const metadata = value.metadata as { phone_number_id?: string } | undefined;
      const phoneNumberId = metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const whatsappNumber = await prisma.whatsappNumber.findFirst({
        where: {
          phoneNumberId,
          isActive: true,
        },
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
        if (!metaMessageId || !statusValue) continue;
        const statusTimestamp = parseMetaTimestamp(status.timestamp);
        await handleOutboundStatusWebhook({
          organizationId: orgId,
          whatsappNumberId: whatsappNumber.id,
          phoneNumberId,
          metaMessageId,
          statusValue,
          statusTimestamp,
          status,
        });
      }

      for (const msg of (value.messages as Array<Record<string, unknown>>) || []) {
        const startMsgTime = Date.now();
        const metaMessageId = msg.id as string;
        const messageType = msg.type as string;
        const contactPhone = normalizePhoneIdentity(String(msg.from || ''));
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
        const contactEntry = contacts.find(
          (c) => c.wa_id && normalizePhoneIdentity(c.wa_id) === contactPhone
        );
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

        const inboundConsent = inboundReplyConsentFields(inboundTimestamp);

        const contactResolution = await prisma.$transaction(async (tx) => {
          // Serialize all contact creation paths that honor this quota. The
          // organization row is the shared lock, so concurrent webhook workers
          // cannot both pass the count check and exceed the plan limit.
          await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId} FOR UPDATE`;
          const priorContact = await tx.contact.findUnique({
            where: {
              organizationId_whatsappNumberId_normalizedPhone: {
                organizationId: orgId,
                whatsappNumberId: whatsappNumber.id,
                normalizedPhone: contactPhone,
              },
            },
            select: { id: true },
          });

          if (!priorContact) {
            const quota = await checkQuota(orgId, 'contacts', 1);
            if (!quota.allowed) {
              await tx.inboundContactOverflow.upsert({
                where: { metaMessageId: msg.id as string },
                create: {
                  organizationId: orgId,
                  whatsappNumberId: whatsappNumber.id,
                  metaMessageId: msg.id as string,
                  contactPhone,
                  payload: msg as Prisma.InputJsonValue,
                  reason: 'CONTACT_QUOTA_EXCEEDED',
                },
                update: {},
              });
              return {
                contact: null,
                created: false,
                overflow: { used: quota.used, limit: quota.limit },
              };
            }
          }

          let contact = await tx.contact.upsert({
            where: {
              organizationId_whatsappNumberId_normalizedPhone: {
                organizationId: orgId,
                whatsappNumberId: whatsappNumber.id,
                normalizedPhone: contactPhone,
              },
            },
            create: {
              organizationId: orgId,
              phone: contactPhone,
              normalizedPhone: contactPhone,
              whatsappNumberId: whatsappNumber.id,
              name: contactName,
              source: 'INBOUND',
              ...NEW_CONTACT_CALLING_DEFAULTS,
              ...inboundConsent,
            },
            update: contactName ? { name: contactName } : {},
          });

          if (shouldGrantInboundReplyConsent(contact)) {
            contact = await tx.contact.update({
              where: { id: contact.id },
              data: inboundConsent,
            });
          }

          return { contact, created: !priorContact, overflow: null };
        });

        if (!contactResolution.contact) {
          emitToOrg(orgId, 'contact:overflow', {
            whatsappNumberId: whatsappNumber.id,
            contactPhone,
            metaMessageId: msg.id,
            used: contactResolution.overflow?.used ?? 0,
            limit: contactResolution.overflow?.limit ?? 0,
          });
          log.warn('Inbound contact held at quota limit', {
            organizationId: orgId,
            whatsappNumberId: whatsappNumber.id,
            contactPhone,
            metaMessageId: msg.id,
          });
          continue;
        }

        const contact = contactResolution.contact;
        if (contactResolution.created) {
          await applyGlobalCallingToContactIfEnabled(orgId, contact.id);
        }

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
            ...NEW_CONVERSATION_CHAT_DEFAULTS,
          },
          update: {},
        });

        const isNew = !priorConversation;

        await applyGlobalChatToConversation(orgId, conversation.id, whatsappNumber.id);

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

        let message: InboundFollowupMessage | null = null;
        let duplicateInsert = false;
        try {
          message = await prisma.$transaction(async (tx) => {
            const created = await tx.message.create({
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
            const conversationState = await tx.conversation.findUnique({
              where: { id: conversation.id },
              select: { firstResponseAt: true, slaDueAt: true },
            });
            const sideEffects = inboundConversationSideEffectData(
              inboundTimestamp,
              conversationState
            );
            const { unreadCount: _unreadCount, ...timestampSideEffects } = sideEffects;
            await tx.conversation.updateMany({
              where: inboundConversationRepairWhere(conversation.id, inboundTimestamp),
              data: timestampSideEffects,
            });
            await tx.conversation.update({
              where: { id: conversation.id },
              data: { unreadCount: { increment: 1 } },
            });
            return created;
          });
        } catch (err) {
          // Meta may retry the same webhook; metaMessageId is unique.
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            log.info('Duplicate inbound message — resuming incomplete side-effects', {
              metaMessageId,
              organizationId: orgId,
            });
            const existing = await prisma.message.findFirst({
              where: {
                metaMessageId,
                conversation: { organizationId: orgId, whatsappNumberId: whatsappNumber.id },
              },
              select: {
                id: true,
                conversationId: true,
                direction: true,
                type: true,
                content: true,
                createdAt: true,
                status: true,
                metadata: true,
              },
            });
            if (!existing) continue;
            duplicateInsert = true;
            message = existing;
            const conversationState = await prisma.conversation.findUnique({
              where: { id: existing.conversationId },
              select: { lastMessageAt: true, firstResponseAt: true, slaDueAt: true },
            });
            if (needsInboundConversationRepair(conversationState?.lastMessageAt, inboundTimestamp)) {
              const repaired = await prisma.conversation.updateMany({
                where: inboundConversationRepairWhere(existing.conversationId, inboundTimestamp),
                data: inboundConversationSideEffectData(inboundTimestamp, conversationState ?? null),
              });
              if (repaired.count === 1) {
                log.info('Repaired inbound conversation side-effects after duplicate insert', {
                  metaMessageId,
                  conversationId: existing.conversationId,
                  organizationId: orgId,
                });
              }
            }
          } else {
            throw err;
          }
        }
        if (!message) continue;
        if (!duplicateInsert) {
          emitProductEvent({
            organizationId: orgId,
            name: 'MESSAGE_IN',
          });
        }

        await applyInboundMessageFollowups({
          orgId,
          whatsappNumber,
          conversation,
          contact,
          message,
          parsed,
          inboundMetadata,
          contactPhone,
          inboundTimestamp,
          metaMessageId,
          isNew,
          msgType: (msg.type as string | undefined)?.toLowerCase() || 'text',
          startMsgTime,
        });
      }

      log.info('Webhook processing complete', {
        organizationId: orgId,
        totalTimeMs: Date.now() - startTime,
      });
    }
  }
}

export async function replayInboundContactOverflow(overflowId: string): Promise<boolean> {
  const overflow = await prisma.inboundContactOverflow.findUnique({
    where: { id: overflowId },
  });
  if (!overflow || overflow.resolvedAt) return false;
  const message = overflow.payload as Record<string, unknown>;
  const whatsappNumber = await prisma.whatsappNumber.findFirst({
    where: {
      id: overflow.whatsappNumberId,
      organizationId: overflow.organizationId,
      isActive: true,
    },
    select: { phoneNumberId: true },
  });
  if (!whatsappNumber) return false;
  const quota = await checkQuota(overflow.organizationId, 'contacts', 1);
  if (!quota.allowed) return false;

  await processWebhookPayload({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: whatsappNumber.phoneNumberId },
              contacts: [{ wa_id: overflow.contactPhone, profile: { name: overflow.contactPhone } }],
              messages: [message],
            },
          },
        ],
      },
    ],
  });
  const resolved = await prisma.inboundContactOverflow.updateMany({
    where: { id: overflow.id, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  return resolved.count === 1;
}