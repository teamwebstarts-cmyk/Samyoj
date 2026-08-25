import type { MessageType } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { MetaWhatsAppService, extractMetaErrorFields, isWithin24HourWindow } from '../whatsapp/meta.service';
import { getOrgWhatsappContext } from '../whatsapp/context';
import { buildTemplateComponents } from '../campaigns/template-params';
import { emitToOrg } from '../../realtime';
import { buildInteractivePayload, type InteractiveMessageOptions } from './interactive';
import { normalizePhone } from '../../utils/phone';
import { createModuleLogger } from '../../utils/logger';
import { resolveCs24hWindowOpensAt } from '../inbox/service-window';
import { isAgentOnlyChatMetadata } from './agent-only';
import { emitProductEvent } from '../platform/events';
import { getOrgEntitlements } from '../billing/entitlements.service';

const log = createModuleLogger('messages');

export const CSW_CLOSED_CODE = 'CSW_CLOSED';
export const META_CSW_ERROR_CODE = 131047;

export function isCswClosedError(error: unknown): boolean {
  if (error instanceof AppError && error.code === CSW_CLOSED_CODE) return true;
  return extractMetaErrorFields(error).metaCode === META_CSW_ERROR_CODE;
}

export type DeliverMessageType =
  | 'TEXT'
  | 'TEMPLATE'
  | 'INTERACTIVE'
  | 'IMAGE'
  | 'DOCUMENT'
  | 'VIDEO'
  | 'AUDIO'
  | 'LOCATION'
  | 'CONTACTS';

export function toDbMessageType(type: DeliverMessageType): MessageType {
  const map: Record<DeliverMessageType, MessageType> = {
    TEXT: 'TEXT',
    TEMPLATE: 'TEMPLATE',
    INTERACTIVE: 'INTERACTIVE',
    IMAGE: 'IMAGE',
    DOCUMENT: 'DOCUMENT',
    VIDEO: 'VIDEO',
    AUDIO: 'AUDIO',
    LOCATION: 'LOCATION',
    CONTACTS: 'CONTACTS',
  };
  return map[type] || 'TEXT';
}

function formatContactForWhatsApp(contact: { name: string; phone: string; email?: string }) {
  const phone = normalizePhone(contact.phone);
  const firstName = contact.name.trim().split(/\s+/)[0] || contact.name.trim();
  return {
    name: { formatted_name: contact.name.trim(), first_name: firstName },
    phones: [{ phone, type: 'CELL' as const }],
    ...(contact.email?.trim() ? { emails: [{ email: contact.email.trim(), type: 'WORK' as const }] } : {}),
  };
}

interface DeliverMessageInput {
  organizationId: string;
  whatsappNumberId?: string;
  messageId: string;
  /** @deprecated Provider phone ID is resolved from the active DB workspace. */
  phoneNumberId?: string;
  /** @deprecated Queue workers must resolve the encrypted token from the DB. */
  encryptedToken?: string;
  /** @deprecated Recipient is resolved from the organization-owned conversation contact. */
  to: string;
  content: string;
  type: DeliverMessageType;
  templateName?: string;
  templateLanguage?: string;
  templateParams?: { body?: string[]; header?: string[]; headerMediaUrl?: string; couponCode?: string; buttonUrlSuffixes?: string[] };
  buttons?: Array<{ id: string; title: string }>;
  interactive?: InteractiveMessageOptions;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: Array<{
    name: string;
    phone: string;
    email?: string;
  }>;
  waFlow?: {
    flowId: string;
    flowToken: string;
    cta: string;
    screen?: string;
    body?: string;
  };
  mediaUrl?: string;
  /** Local relative path under uploads/media — preferred for Meta upload-by-id. */
  mediaPath?: string;
  mediaMimeType?: string;
  mediaFilename?: string;
  mediaCaption?: string;
  contextMessageId?: string;
  /** When true, Meta treats AUDIO as a WhatsApp voice note. */
  voiceNote?: boolean;
}

/**
 * Resolve outbound media the Meta-recommended way: upload bytes → send by `id`.
 * Falls back to public `link` only when we cannot read local bytes (e.g. external URL).
 */
async function resolveMediaRef(options: {
  phoneNumberId: string;
  accessToken: string;
  mediaPath?: string;
  mediaUrl?: string;
  mimeType?: string;
  filename?: string;
}): Promise<{ id?: string; link?: string }> {
  let mime = options.mimeType || 'application/octet-stream';
  let filename = options.filename;

  if (options.mediaPath) {
    try {
      const { fetchMediaBuffer } = await import('../media/storage-adapter');
      let buffer = await fetchMediaBuffer(options.mediaPath);
      const { ensureWhatsAppAudio, needsWhatsAppAudioTranscode } = await import(
        '../media/audio-transcode'
      );
      if (needsWhatsAppAudioTranscode(mime, filename)) {
        const converted = await ensureWhatsAppAudio({ buffer, mimeType: mime, filename });
        buffer = converted.buffer;
        mime = converted.mimeType;
        filename = converted.filename;
      }
      const id = await MetaWhatsAppService.uploadMedia({
        phoneNumberId: options.phoneNumberId,
        accessToken: options.accessToken,
        buffer,
        mimeType: mime,
        filename,
      });
      return { id };
    } catch (err) {
      log.warn('Meta media upload failed; falling back to link if available', {
        mediaPath: options.mediaPath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (options.mediaUrl) {
    // Prefer uploading even from our own public URL so Meta caches the asset.
    if (options.mediaUrl.includes('/api/media/public/')) {
      try {
        const relative = options.mediaUrl.split('/api/media/public/')[1];
        if (relative) {
          const { fetchMediaBuffer } = await import('../media/storage-adapter');
          let buffer = await fetchMediaBuffer(decodeURIComponent(relative));
          let uploadMime = mime;
          let uploadName = filename;
          const { ensureWhatsAppAudio, needsWhatsAppAudioTranscode } = await import(
            '../media/audio-transcode'
          );
          if (needsWhatsAppAudioTranscode(uploadMime, uploadName)) {
            const converted = await ensureWhatsAppAudio({
              buffer,
              mimeType: uploadMime,
              filename: uploadName,
            });
            buffer = converted.buffer;
            uploadMime = converted.mimeType;
            uploadName = converted.filename;
          }
          const id = await MetaWhatsAppService.uploadMedia({
            phoneNumberId: options.phoneNumberId,
            accessToken: options.accessToken,
            buffer,
            mimeType: uploadMime,
            filename: uploadName,
          });
          return { id };
        }
      } catch (err) {
        log.warn('Could not upload from public media URL; using link', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { link: options.mediaUrl };
  }

  throw new AppError(400, 'Media is required for this message type');
}

export async function deliverOutboundMessage(input: DeliverMessageInput) {
  const entitlements = await getOrgEntitlements(input.organizationId);
  if (entitlements.isLocked) {
    throw new AppError(
      402,
      'Your paid period has expired. Purchase a plan before sending messages.',
      'SUBSCRIPTION_LOCKED'
    );
  }

  let whatsappNumberId = input.whatsappNumberId;
  if (!whatsappNumberId) {
    const messageContext = await prisma.message.findFirst({
      where: {
        id: input.messageId,
        conversation: { organizationId: input.organizationId },
      },
      select: { conversation: { select: { whatsappNumberId: true } } },
    });
    whatsappNumberId = messageContext?.conversation.whatsappNumberId || undefined;
  }

  if (!whatsappNumberId) {
    throw new AppError(400, 'WhatsApp number context is required for this message');
  }

  const whatsappNumber = await prisma.whatsappNumber.findFirst({
    where: {
      id: whatsappNumberId,
      organizationId: input.organizationId,
      isActive: true,
    },
    select: { id: true, phoneNumberId: true, accessToken: true },
  });
  if (!whatsappNumber) {
    throw new AppError(400, 'WhatsApp number not found or inactive');
  }

  const phoneNumberId = whatsappNumber.phoneNumberId;
  const accessToken = MetaWhatsAppService.decryptToken(whatsappNumber.accessToken);

  try {
    const ownedMessage = await prisma.message.findFirst({
      where: {
        id: input.messageId,
        conversation: {
          organizationId: input.organizationId,
          whatsappNumberId: whatsappNumber.id,
        },
      },
      select: {
        id: true,
        conversation: { select: { contact: { select: { phone: true } } } },
      },
    });
    if (!ownedMessage) {
      throw new AppError(404, 'Message does not belong to the active WhatsApp number');
    }
    const phone = ownedMessage.conversation.contact.phone.replace(/\D/g, '');
    if (!phone) {
      throw new AppError(400, 'Message recipient is missing a valid phone number');
    }

    const agentOnlyRow = await prisma.message.findUnique({
      where: { id: input.messageId },
      select: { id: true, metadata: true, status: true, conversationId: true },
    });
    if (isAgentOnlyChatMetadata(agentOnlyRow?.metadata)) {
      log.info('Skipped Cloud send — agent-only chat row', {
        organizationId: input.organizationId,
        messageId: input.messageId,
        conversationId: agentOnlyRow?.conversationId,
      });
      if (agentOnlyRow?.status && agentOnlyRow.status !== 'READ') {
        return prisma.message.update({
          where: { id: input.messageId },
          data: { status: 'READ' },
        });
      }
      const existing = await prisma.message.findUnique({ where: { id: input.messageId } });
      if (!existing) {
        throw new AppError(404, 'Message not found');
      }
      return existing;
    }

    if (input.type !== 'TEMPLATE') {
      const messageRow = await prisma.message.findUnique({
        where: { id: input.messageId },
        select: {
          conversationId: true,
          metadata: true,
          conversation: { select: { cs24hWindowOpensAt: true } },
        },
      });
      if (messageRow) {
        const windowOpensAt = await resolveCs24hWindowOpensAt(
          messageRow.conversationId,
          messageRow.conversation?.cs24hWindowOpensAt
        );
        if (!isWithin24HourWindow(windowOpensAt)) {
          const errorMessage =
            'Customer service window closed. Free-form messages cannot be sent. Use a template.';
          log.warn('Skipped free-form send — customer service window closed', {
            organizationId: input.organizationId,
            conversationId: messageRow.conversationId,
            messageId: input.messageId,
            type: input.type,
            metaCode: META_CSW_ERROR_CODE,
          });
          await prisma.message.update({
            where: { id: input.messageId },
            data: {
              status: 'FAILED',
              metadata: {
                ...((messageRow.metadata as Record<string, unknown>) || {}),
                error: errorMessage,
                metaCode: META_CSW_ERROR_CODE,
                skippedCsw: true,
              },
            },
          });
          emitToOrg(input.organizationId, 'message:status', {
            messageId: input.messageId,
            status: 'FAILED',
            error: errorMessage,
            metaCode: META_CSW_ERROR_CODE,
            conversationId: messageRow.conversationId,
          });
          throw new AppError(400, errorMessage, CSW_CLOSED_CODE);
        }
      }
    }

    let result;
    const context = input.contextMessageId
      ? { context: { message_id: input.contextMessageId } }
      : {};
    if (input.type === 'TEMPLATE' && input.templateName) {
      let components: unknown[] = [];
      if (input.templateParams) {
        const { wabaId, accessToken: orgToken } = await getOrgWhatsappContext(
          input.organizationId,
          whatsappNumberId
        );
        const template = await MetaWhatsAppService.getMessageTemplate(
          wabaId,
          orgToken,
          input.templateName
        );
        components = buildTemplateComponents(input.templateParams, template);
      }

      result = await MetaWhatsAppService.sendMessage(phoneNumberId, accessToken, {
        to: phone,
        type: 'template',
        template: {
          name: input.templateName,
          language: { code: input.templateLanguage || 'en_US' },
          ...(components.length ? { components } : {}),
        },
      });
    } else if (input.type === 'INTERACTIVE' && (input.interactive || input.buttons?.length)) {
      const interactiveOpts: InteractiveMessageOptions = input.interactive || {
        mode: 'reply',
        body: input.content,
        buttons: input.buttons,
      };
      result = await MetaWhatsAppService.sendMessage(
        phoneNumberId,
        accessToken,
        { ...buildInteractivePayload(phone, interactiveOpts), ...context }
      );
    } else if (input.type === 'IMAGE' && (input.mediaUrl || input.mediaPath)) {
      const media = await resolveMediaRef({
        phoneNumberId,
        accessToken,
        mediaPath: input.mediaPath,
        mediaUrl: input.mediaUrl,
        mimeType: input.mediaMimeType || 'image/jpeg',
        filename: input.mediaFilename,
      });
      result = await MetaWhatsAppService.sendMessage(phoneNumberId, accessToken, {
        to: phone,
        type: 'image',
        image: { ...media, caption: input.mediaCaption || undefined },
        ...context,
      });
    } else if (input.type === 'DOCUMENT' && (input.mediaUrl || input.mediaPath)) {
      const media = await resolveMediaRef({
        phoneNumberId,
        accessToken,
        mediaPath: input.mediaPath,
        mediaUrl: input.mediaUrl,
        mimeType: input.mediaMimeType || 'application/pdf',
        filename: input.mediaFilename,
      });
      result = await MetaWhatsAppService.sendMessage(phoneNumberId, accessToken, {
        to: phone,
        type: 'document',
        document: {
          ...media,
          caption: input.mediaCaption || undefined,
          // Meta uses filename extension to pick the document icon on WhatsApp.
          filename: input.mediaFilename || 'document.pdf',
        },
        ...context,
      });
    } else if (input.type === 'VIDEO' && (input.mediaUrl || input.mediaPath)) {
      const media = await resolveMediaRef({
        phoneNumberId,
        accessToken,
        mediaPath: input.mediaPath,
        mediaUrl: input.mediaUrl,
        mimeType: input.mediaMimeType || 'video/mp4',
        filename: input.mediaFilename,
      });
      result = await MetaWhatsAppService.sendMessage(phoneNumberId, accessToken, {
        to: phone,
        type: 'video',
        video: { ...media, caption: input.mediaCaption || undefined },
        ...context,
      });
    } else if (input.type === 'AUDIO' && (input.mediaUrl || input.mediaPath)) {
      const media = await resolveMediaRef({
        phoneNumberId,
        accessToken,
        mediaPath: input.mediaPath,
        mediaUrl: input.mediaUrl,
        mimeType: input.mediaMimeType || 'audio/ogg',
        filename: input.mediaFilename,
      });
      result = await MetaWhatsAppService.sendMessage(phoneNumberId, accessToken, {
        to: phone,
        type: 'audio',
        audio: {
          ...media,
          ...(input.voiceNote ? { voice: true } : {}),
        },
        ...context,
      });
    } else if (input.type === 'LOCATION' && input.location) {
      result = await MetaWhatsAppService.sendMessage(phoneNumberId, accessToken, {
        to: phone,
        type: 'location',
        location: input.location,
      });
    } else if (input.type === 'CONTACTS' && input.contacts?.length) {
      const contacts = input.contacts
        .map((c) => formatContactForWhatsApp(c))
        .filter((c) => c.phones[0]?.phone.length >= 10);
      if (!contacts.length) {
        throw new AppError(400, 'Contact card needs a valid phone number with country code');
      }
      result = await MetaWhatsAppService.sendMessage(phoneNumberId, accessToken, {
        to: phone,
        type: 'contacts',
        contacts,
      });
    } else if (input.waFlow) {
      result = await MetaWhatsAppService.sendMessage(phoneNumberId, accessToken, {
        to: phone,
        type: 'interactive',
        ...context,
        interactive: {
          type: 'flow',
          body: { text: input.waFlow.body || 'Please complete the form' },
          action: {
            name: 'flow',
            parameters: {
              flow_message_version: '3',
              flow_token: input.waFlow.flowToken,
              flow_id: input.waFlow.flowId,
              flow_cta: input.waFlow.cta.slice(0, 20),
              flow_action: 'navigate',
              ...(input.waFlow.screen
                ? { flow_action_payload: { screen: input.waFlow.screen, data: {} } }
                : {}),
            },
          },
        },
      });
    } else {
      result = await MetaWhatsAppService.sendMessage(phoneNumberId, accessToken, {
        to: phone,
        type: 'text',
        text: { body: input.content },
        ...context,
      });
    }

    const metaMessageId = result.messages?.[0]?.id;
    const message = await prisma.message.update({
      where: { id: input.messageId },
      data: { metaMessageId, status: 'SENT' },
    });
    if (metaMessageId) {
      const { reconcileUnmatchedProviderStatuses } = await import('../whatsapp/provider-status');
      await reconcileUnmatchedProviderStatuses({
        organizationId: input.organizationId,
        metaMessageId,
        whatsappNumberId,
        phoneNumberId,
      });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: message.conversationId },
      select: { id: true, lastMessageAt: true, unreadCount: true },
    });

    emitToOrg(input.organizationId, 'message:new', {
      conversationId: message.conversationId,
      message,
      conversation: conversation
        ? {
            ...conversation,
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
    emitToOrg(input.organizationId, 'message:status', {
      messageId: input.messageId,
      status: 'SENT',
      conversationId: message.conversationId,
    });
    emitProductEvent({
      organizationId: input.organizationId,
      name: 'MESSAGE_OUT',
    });

    return message;
  } catch (error) {
    if (error instanceof AppError && error.code === CSW_CLOSED_CODE) {
      throw error;
    }

    const { message: errorMessage, metaCode, metaSubcode, fbtraceId } = extractMetaErrorFields(error);
    // Merge the error into existing metadata so send params (mediaPath,
    // templateName, interactive, …) survive for POST /inbox/messages/:id/retry.
    const existing = await prisma.message.findUnique({
      where: { id: input.messageId },
      select: { metadata: true, conversationId: true },
    });

    log.error('Outbound Meta send failed', {
      source: 'inbox',
      organizationId: input.organizationId,
      conversationId: existing?.conversationId,
      messageId: input.messageId,
      type: input.type,
      metaCode,
      metaSubcode,
      fbtraceId,
      error: errorMessage,
    });

    const { emitMetaErrorStat } = await import('../platform/meta-errors');
    emitMetaErrorStat({
      organizationId: input.organizationId,
      whatsappNumberId,
      code: metaCode,
      sampleTitle: errorMessage,
    });

    const message = await prisma.message.update({
      where: { id: input.messageId },
      data: {
        status: 'FAILED',
        metadata: {
          ...((existing?.metadata as Record<string, unknown>) || {}),
          error: errorMessage,
          ...(metaCode !== undefined ? { metaCode } : {}),
          ...(metaSubcode !== undefined ? { metaSubcode } : {}),
          ...(fbtraceId ? { fbtraceId } : {}),
        },
      },
    });

    emitToOrg(input.organizationId, 'message:status', {
      messageId: input.messageId,
      status: 'FAILED',
      error: errorMessage,
      metaCode,
      fbtraceId,
      conversationId: message.conversationId,
    });

    throw metaCode === META_CSW_ERROR_CODE
      ? new AppError(400, errorMessage, CSW_CLOSED_CODE)
      : new AppError(502, errorMessage);
  }
}
