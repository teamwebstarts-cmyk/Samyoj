import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { validatePhone } from '../../utils/phone';
import { getOrgWhatsappContext } from '../whatsapp/context';
import { getTemplateDisplayText, isWithin24HourWindow, MetaWhatsAppService } from '../whatsapp/meta.service';
import { deliverOutboundMessage } from './send.service';
import { emitToOrg } from '../../realtime';
import type { MessageStatus, MessageType } from '@prisma/client';

interface SendDirectMessageInput {
  phone: string;
  name?: string;
  content: string;
  type?: 'TEXT' | 'TEMPLATE';
  templateName?: string;
  templateLanguage?: string;
}

export interface RecordOutboundInput {
  organizationId: string;
  whatsappNumberId: string;
  phone: string;
  name?: string;
  content: string;
  type?: MessageType;
  status?: MessageStatus;
  metaMessageId?: string;
  metadata?: Record<string, unknown>;
}

/** Persist an outbound WhatsApp message so it appears in the inbox. */
export async function recordOutboundInConversation(input: RecordOutboundInput) {
  const phoneResult = validatePhone(input.phone);
  if (!phoneResult.ok) throw new AppError(400, phoneResult.error);
  const phone = phoneResult.phone;

  const contact = await prisma.contact.upsert({
    where: { organizationId_phone: { organizationId: input.organizationId, phone } },
    create: {
      organizationId: input.organizationId,
      phone,
      name: input.name,
      optedIn: true,
    },
    update: { name: input.name || undefined },
  });

  let conversation = await prisma.conversation.findFirst({
    where: { organizationId: input.organizationId, contactId: contact.id },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        organizationId: input.organizationId,
        contactId: contact.id,
        whatsappNumberId: input.whatsappNumberId,
      },
    });
  } else if (!conversation.whatsappNumberId) {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { whatsappNumberId: input.whatsappNumberId },
    });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      type: input.type || 'TEXT',
      content: input.content,
      status: input.status || 'SENT',
      metaMessageId: input.metaMessageId,
      metadata: input.metadata ? (input.metadata as object) : undefined,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  emitToOrg(input.organizationId, 'message:new', {
    conversationId: conversation.id,
    message,
  });

  return { message, conversation, contact };
}

export async function sendDirectMessage(organizationId: string, input: SendDirectMessageInput) {
  const phoneResult = validatePhone(input.phone);
  if (!phoneResult.ok) throw new AppError(400, phoneResult.error);
  const phone = phoneResult.phone;

  const { whatsappNumber } = await getOrgWhatsappContext(organizationId);
  const type = input.type || 'TEXT';

  const contact = await prisma.contact.upsert({
    where: { organizationId_phone: { organizationId, phone } },
    create: { organizationId, phone, name: input.name, optedIn: true, source: 'OUTBOUND' },
    update: { name: input.name || undefined },
  });

  let conversation = await prisma.conversation.findFirst({
    where: { organizationId, contactId: contact.id },
    include: {
      messages: {
        where: { direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        organizationId,
        contactId: contact.id,
        whatsappNumberId: whatsappNumber.id,
        lastMessageAt: new Date(),
      },
      include: {
        messages: {
          where: { direction: 'INBOUND' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  const lastInbound = conversation.messages[0]?.createdAt ?? null;
  if (type === 'TEXT' && !isWithin24HourWindow(lastInbound)) {
    throw new AppError(
      400,
      'Cannot send text message. Customer must reply first (24-hour window) or use a Template message instead.'
    );
  }

  let messageContent = input.content;
  let messageMetadata: Record<string, unknown> | undefined;

  if (type === 'TEMPLATE' && input.templateName) {
    const { wabaId, accessToken } = await getOrgWhatsappContext(organizationId);
    const template = await MetaWhatsAppService.getMessageTemplate(
      wabaId,
      accessToken,
      input.templateName
    );
    messageContent = getTemplateDisplayText(template, input.templateName);
    messageMetadata = {
      templateName: input.templateName,
      templateLanguage: input.templateLanguage || template?.language || 'en_US',
    };
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      type: type === 'TEMPLATE' ? 'TEMPLATE' : 'TEXT',
      content: messageContent,
      status: 'PENDING',
      metadata: messageMetadata as import('@prisma/client').Prisma.InputJsonValue,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  const sentMessage = await deliverOutboundMessage({
    organizationId,
    messageId: message.id,
    phoneNumberId: whatsappNumber.phoneNumberId,
    encryptedToken: whatsappNumber.accessToken,
    to: phone,
    content: type === 'TEMPLATE' ? input.templateName || input.content : input.content,
    type,
    templateName: input.templateName,
    templateLanguage: input.templateLanguage || 'en_US',
  });

  return { message: sentMessage, conversationId: conversation.id, contact };
}

export {
  finalizeCampaignIfDone,
  syncRunningCampaignStatuses,
} from '../campaigns/service';
