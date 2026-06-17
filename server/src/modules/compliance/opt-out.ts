import prisma from '../../config/database';
import { sendDirectMessage } from '../messages/service';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('opt-out');

const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'opt out', 'opt-out', 'remove me'];

export function isOptOutMessage(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return OPT_OUT_KEYWORDS.some((kw) => normalized === kw || normalized.startsWith(`${kw} `));
}

export async function handleOptOut(
  organizationId: string,
  contactId: string,
  _conversationId: string,
  _whatsappNumberId: string
): Promise<boolean> {
  const contact = await prisma.contact.findUniqueOrThrow({
    where: { id: contactId },
    select: { phone: true },
  });

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      optedIn: false,
      consentSource: 'STOP_KEYWORD',
      consentAt: new Date(),
    },
  });

  log.info('Contact opted out via STOP keyword', { organizationId, contactId });

  try {
    await sendDirectMessage(organizationId, {
      phone: contact.phone,
      content:
        'You have been unsubscribed. You will no longer receive marketing messages. Reply START to opt back in.',
      type: 'TEXT',
    });
  } catch (err) {
    log.warn('Opt-out confirmation message failed', { error: String(err) });
  }

  return true;
}

export async function handleOptIn(organizationId: string, contactId: string): Promise<boolean> {
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      optedIn: true,
      consentSource: 'START_KEYWORD',
      consentAt: new Date(),
    },
  });
  return true;
}

export function isOptInMessage(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized === 'start' || normalized === 'subscribe';
}
