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
  customMessage?: string;
}): Promise<void> {
  const settings = await getOrgCallingSettings(params.organizationId);

  if (!settings.missedCallAutoMessage && !params.customMessage) return;

  const message = params.customMessage?.trim() || settings.missedCallMessage;
  if (!message) return;

  let conversationId = params.conversationId;

  if (!conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        organizationId: params.organizationId,
        contactId: params.contactId,
      },
      orderBy: { lastMessageAt: 'desc' },
    });
    conversationId = conversation?.id;
  }

  if (!conversationId) {
    log.warn('No conversation for missed call follow-up', { callId: params.callId });
    return;
  }

  const contact = await prisma.contact.findUnique({ where: { id: params.contactId } });
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
    where: { organizationId: params.organizationId, isActive: true },
  });

  if (conversationId && whatsappNumber) {
    const flowHandled = await triggerMissedCallFlow({
      organizationId: params.organizationId,
      conversationId,
      contactId: params.contactId,
      contactPhone: contact.phone,
      phoneNumberId: whatsappNumber.phoneNumberId,
      encryptedToken: whatsappNumber.accessToken,
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
    });
    log.info('Missed call follow-up sent', { callId: params.callId, conversationId });
  } catch (err) {
    log.error('Missed call follow-up failed', {
      callId: params.callId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
