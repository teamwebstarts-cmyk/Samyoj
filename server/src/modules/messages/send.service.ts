import type { MessageType } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { getOrgWhatsappContext } from '../whatsapp/context';
import { buildTemplateComponents } from '../campaigns/template-params';
import { emitToOrg } from '../../realtime';
import { buildInteractivePayload, type InteractiveMessageOptions } from './interactive';
import { normalizePhone } from '../../utils/phone';

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
  messageId: string;
  phoneNumberId: string;
  encryptedToken: string;
  to: string;
  content: string;
  type: DeliverMessageType;
  templateName?: string;
  templateLanguage?: string;
  templateParams?: { body?: string[]; header?: string[]; headerMediaUrl?: string; couponCode?: string };
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
  mediaCaption?: string;
}

export async function deliverOutboundMessage(input: DeliverMessageInput) {
  const phone = input.to.replace(/\D/g, '');
  const accessToken = MetaWhatsAppService.decryptToken(input.encryptedToken);

  try {
    let result;
    if (input.type === 'TEMPLATE' && input.templateName) {
      let components: unknown[] = [];
      if (input.templateParams) {
        const { wabaId, accessToken: orgToken } = await getOrgWhatsappContext(input.organizationId);
        const template = await MetaWhatsAppService.getMessageTemplate(
          wabaId,
          orgToken,
          input.templateName
        );
        components = buildTemplateComponents(input.templateParams, template);
      }

      result = await MetaWhatsAppService.sendMessage(input.phoneNumberId, accessToken, {
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
        input.phoneNumberId,
        accessToken,
        buildInteractivePayload(phone, interactiveOpts)
      );
    } else if (input.type === 'IMAGE' && input.mediaUrl) {
      result = await MetaWhatsAppService.sendMessage(input.phoneNumberId, accessToken, {
        to: phone,
        type: 'image',
        image: { link: input.mediaUrl, caption: input.mediaCaption || input.content },
      });
    } else if (input.type === 'DOCUMENT' && input.mediaUrl) {
      result = await MetaWhatsAppService.sendMessage(input.phoneNumberId, accessToken, {
        to: phone,
        type: 'document',
        document: { link: input.mediaUrl, caption: input.mediaCaption || input.content },
      });
    } else if (input.type === 'VIDEO' && input.mediaUrl) {
      result = await MetaWhatsAppService.sendMessage(input.phoneNumberId, accessToken, {
        to: phone,
        type: 'video',
        video: { link: input.mediaUrl, caption: input.mediaCaption || input.content },
      });
    } else if (input.type === 'AUDIO' && input.mediaUrl) {
      result = await MetaWhatsAppService.sendMessage(input.phoneNumberId, accessToken, {
        to: phone,
        type: 'audio',
        audio: { link: input.mediaUrl },
      });
    } else if (input.type === 'LOCATION' && input.location) {
      result = await MetaWhatsAppService.sendMessage(input.phoneNumberId, accessToken, {
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
      result = await MetaWhatsAppService.sendMessage(input.phoneNumberId, accessToken, {
        to: phone,
        type: 'contacts',
        contacts,
      });
    } else if (input.waFlow) {
      result = await MetaWhatsAppService.sendMessage(input.phoneNumberId, accessToken, {
        to: phone,
        type: 'interactive',
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
      result = await MetaWhatsAppService.sendMessage(input.phoneNumberId, accessToken, {
        to: phone,
        type: 'text',
        text: { body: input.content },
      });
    }

    const metaMessageId = result.messages?.[0]?.id;
    const message = await prisma.message.update({
      where: { id: input.messageId },
      data: { metaMessageId, status: 'SENT' },
    });

    emitToOrg(input.organizationId, 'message:new', {
      conversationId: message.conversationId,
      message,
    });
    emitToOrg(input.organizationId, 'message:status', {
      messageId: input.messageId,
      status: 'SENT',
      conversationId: message.conversationId,
    });

    return message;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message';

    const message = await prisma.message.update({
      where: { id: input.messageId },
      data: {
        status: 'FAILED',
        metadata: { error: errorMessage },
      },
    });

    emitToOrg(input.organizationId, 'message:status', {
      messageId: input.messageId,
      status: 'FAILED',
      error: errorMessage,
      conversationId: message.conversationId,
    });

    throw new AppError(502, errorMessage);
  }
}
