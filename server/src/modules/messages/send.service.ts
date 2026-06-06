import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { emitToOrg } from '../../realtime';

interface DeliverMessageInput {
  organizationId: string;
  messageId: string;
  phoneNumberId: string;
  encryptedToken: string;
  to: string;
  content: string;
  type: 'TEXT' | 'TEMPLATE';
  templateName?: string;
  templateLanguage?: string;
}

export async function deliverOutboundMessage(input: DeliverMessageInput) {
  const phone = input.to.replace(/\D/g, '');
  const accessToken = MetaWhatsAppService.decryptToken(input.encryptedToken);

  try {
    let result;
    if (input.type === 'TEMPLATE' && input.templateName) {
      result = await MetaWhatsAppService.sendMessage(input.phoneNumberId, accessToken, {
        to: phone,
        type: 'template',
        template: {
          name: input.templateName,
          language: { code: input.templateLanguage || 'en_US' },
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
