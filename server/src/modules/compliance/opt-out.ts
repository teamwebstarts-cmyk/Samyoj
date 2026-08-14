import prisma from '../../config/database';
import { sendDirectMessage } from '../messages/service';
import { createModuleLogger } from '../../utils/logger';
import { randomUUID } from 'node:crypto';

const log = createModuleLogger('opt-out');

/**
 * Exact-token STOP list. Prefix matching "cancel my order" must not opt the
 * contact out (that used to skip the entire inbound automation pipeline).
 * Trailing punctuation is ignored so "STOP!" still works.
 */
const OPT_OUT_KEYWORDS = new Set([
  'stop',
  'stopall',
  'unsubscribe',
  'cancel',
  'end',
  'quit',
  'opt out',
  'opt-out',
  'remove me',
]);

export function isOptOutMessage(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[.!?,;:]+$/g, '').trim();
  return OPT_OUT_KEYWORDS.has(normalized);
}

export async function handleOptOut(
  organizationId: string,
  contactId: string,
  _conversationId: string,
  whatsappNumberId: string,
  occurredAt = new Date(),
  eventId?: string
): Promise<boolean> {
  const contact = await prisma.contact.findUniqueOrThrow({
    where: { id: contactId },
    select: {
      phone: true,
      organizationId: true,
      whatsappNumberId: true,
      consentAt: true,
      optedIn: true,
      consentDecision: true,
    },
  });
  if (contact.organizationId !== organizationId || contact.whatsappNumberId !== whatsappNumberId) return false;
  if (Number.isNaN(occurredAt.getTime())) return false;
  const updated = await prisma.contact.updateMany({
    where: {
      id: contactId,
      organizationId,
      whatsappNumberId,
      OR: [{ consentAt: null }, { consentAt: { lte: occurredAt } }],
    },
    data: {
      optedIn: false,
      consentSource: 'STOP_KEYWORD',
      consentAt: occurredAt,
      consentVersion: 'stop-keyword-v1',
      optOutAt: occurredAt,
      consentDecision: {
        type: 'OPT_OUT', optedIn: false, source: 'STOP_KEYWORD',
        ...(eventId ? { eventId } : {}),
        occurredAt: occurredAt.toISOString(),
      },
    },
  });
  if (updated.count !== 1) return true;

  log.info('Contact opted out via STOP keyword', { organizationId, contactId });

  try {
    await sendDirectMessage(organizationId, {
      phone: contact.phone,
      content:
        'You have been unsubscribed. You will no longer receive marketing messages. Reply START to opt back in.',
      type: 'TEXT',
      whatsappNumberId,
    });
  } catch (err) {
    log.warn('Opt-out confirmation message failed', { error: String(err) });
  }

  return true;
}

export async function handleOptIn(
  organizationId: string,
  contactId: string,
  occurredAt = new Date(),
  eventId: string = randomUUID(),
  whatsappNumberId?: string
): Promise<boolean> {
  if (Number.isNaN(occurredAt.getTime())) return false;
  const current = await prisma.contact.findFirst({
    where: {
      id: contactId,
      organizationId,
      ...(whatsappNumberId ? { whatsappNumberId } : {}),
    },
    select: { consentAt: true },
  });
  if (!current) return false;
  const updated = await prisma.contact.updateMany({
    where: {
      id: contactId,
      organizationId,
      ...(whatsappNumberId ? { whatsappNumberId } : {}),
      OR: [{ consentAt: null }, { consentAt: { lte: occurredAt } }],
    },
    data: {
      optedIn: true,
      consentSource: 'START_KEYWORD',
      consentAt: occurredAt,
      consentVersion: `start-keyword-v1:${eventId}`,
      optOutAt: null,
      consentDecision: {
        type: 'OPT_IN',
        optedIn: true,
        source: 'START_KEYWORD',
        eventId,
        occurredAt: occurredAt.toISOString(),
      },
    },
  });
  if (updated.count !== 1) return true;
  return true;
}

export function isOptInMessage(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized === 'start' || normalized === 'subscribe';
}

export function isConsentEventNewer(currentAt: Date | null | undefined, eventAt: Date) {
  return !Number.isNaN(eventAt.getTime()) &&
    (!currentAt || Number.isNaN(currentAt.getTime()) || eventAt.getTime() > currentAt.getTime());
}
