import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { getOrgWhatsappContext } from '../whatsapp/context';
import { buildTemplateComponents } from '../campaigns/template-params';
import { emitToOrg } from '../../realtime';
import { messageQueue } from '../../config/queues';
import { buildInteractivePayload, type InteractiveMessageOptions } from './interactive';

interface DeliverMessageInput {
  organizationId: string;
  messageId: string;
  phoneNumberId: string;
  encryptedToken: string;
  to: string;
  content: string;
  type: 'TEXT' | 'TEMPLATE' | 'INTERACTIVE' | 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'AUDIO' | 'LOCATION' | 'CONTACTS';
  templateName?: string;
  templateLanguage?: string;
  templateParams?: { body?: string[]; header?: string[]; headerMediaUrl?: string };
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
      result = await MetaWhatsAppService.sendMessage(input.phoneNumberId, accessToken, {
        to: phone,
        type: 'contacts',
        contacts: input.contacts.map((c) => ({
          name: { formatted_name: c.name, first_name: c.name.split(' ')[0] },
          phones: [{ phone: c.phone.replace(/\D/g, ''), type: 'CELL', wa_id: c.phone.replace(/\D/g, '') }],
          ...(c.email ? { emails: [{ email: c.email, type: 'WORK' }] } : {}),
        })),
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

    await messageQueue.add(
      'retry-send',
      {
        messageId: input.messageId,
        organizationId: input.organizationId,
        phoneNumberId: input.phoneNumberId,
        encryptedToken: input.encryptedToken,
        to: input.to,
        content: input.content,
        type: input.type,
        templateName: input.templateName,
        templateLanguage: input.templateLanguage,
        templateParams: input.templateParams,
        buttons: input.buttons,
        interactive: input.interactive,
        location: input.location,
        contacts: input.contacts,
        waFlow: input.waFlow,
        mediaUrl: input.mediaUrl,
        mediaCaption: input.mediaCaption,
      },
      { attempts: 4, backoff: { type: 'custom' } }
    );

    throw new AppError(502, errorMessage);
  }
}
