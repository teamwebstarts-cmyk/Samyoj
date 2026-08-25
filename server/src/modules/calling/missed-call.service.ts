import prisma from '../../config/database';
import { createModuleLogger } from '../../utils/logger';
import { triggerMissedCallFlow } from '../flows/engine';
import { sendDirectMessage } from '../messages/service';
import { getOrgCallingSettings } from './settings.service';

const log = createModuleLogger('missed-call');

export async function handleMissedCallFollowUp(params: {
  organizationId: string;
  callId: string;
  conversationId?: string | null;
  contactId: string;
  whatsappNumberId?: string | null;
  customMessage?: string;
}): Promise<void> {
  const settings = await getOrgCallingSettings(params.organizationId);

  if (!settings.missedCallAutoMessage && !params.customMessage) return;

  const message = params.customMessage?.trim() || settings.missedCallMessage;
  if (!message) return;
  if (!params.whatsappNumberId) {
    log.warn('Missed call follow-up skipped — call has no WhatsApp number identity', {
      callId: params.callId,
    });
    return;
  }

  let conversationId = params.conversationId;

  if (!conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        organizationId: params.organizationId,
        contactId: params.contactId,
        whatsappNumberId: params.whatsappNumberId || undefined,
      },
      orderBy: { lastMessageAt: 'desc' },
    });
    conversationId = conversation?.id;
  }

  if (!conversationId) {
    log.warn('No conversation for missed call follow-up', { callId: params.callId });
    return;
  }

  const contact = await prisma.contact.findFirst({
    where: {
      id: params.contactId,
      organizationId: params.organizationId,
      whatsappNumberId: params.whatsappNumberId || undefined,
    },
  });
  if (!contact) return;

  // Opt-out first: do not trigger missed-call flows or WA auto messages.
  if (contact.optedIn === false) {
    log.info('Missed call follow-up skipped — contact opted out', {
      callId: params.callId,
      contactId: params.contactId,
    });
    return;
  }

  const whatsappNumber = await prisma.whatsappNumber.findFirst({
    where: {
      id: params.whatsappNumberId || undefined,
      organizationId: params.organizationId,
      isActive: true,
    },
  });
  if (!whatsappNumber) return;

  if (conversationId && whatsappNumber) {
    const flowHandled = await triggerMissedCallFlow({
      organizationId: params.organizationId,
      conversationId,
      contactId: params.contactId,
      whatsappNumberId: whatsappNumber.id,
    });
    if (flowHandled) {
      log.info('Missed call handled by automation flow', { callId: params.callId, conversationId });
      return;
    }
  }

  try {
    await sendDirectMessage(params.organizationId, {
      phone: contact.phone,
      name: contact.name || undefined,
      content: message,
      whatsappNumberId: whatsappNumber.id,
    });
    log.info('Missed call follow-up sent', { callId: params.callId, conversationId });
  } catch (err) {
    log.error('Missed call follow-up failed', {
      callId: params.callId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
