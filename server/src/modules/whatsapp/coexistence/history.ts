import { Prisma } from '@prisma/client';
import prisma from '../../../config/database';
import { parseInboundMessage } from '../../inbox/message-parser';
import { createModuleLogger } from '../../../utils/logger';
import { parseMetaTimestamp } from '../../campaigns/safety';
import { normalizePhoneIdentity } from '../../../utils/phone';
import type { WhatsappNumber } from '@prisma/client';
import { mapCoexistenceMessageType } from './message-type';

const log = createModuleLogger('coexistence-history');

const HISTORY_DECLINED_CODE = 2593109;

function mapHistoryStatus(status: string | undefined): 'SENT' | 'DELIVERED' | 'READ' {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'read') return 'READ';
  if (normalized === 'sent') return 'SENT';
  return 'DELIVERED';
}

function resolveDirection(
  from: string,
  businessPhone: string
): 'INBOUND' | 'OUTBOUND' {
  return normalizePhoneIdentity(from) === normalizePhoneIdentity(businessPhone)
    ? 'OUTBOUND'
    : 'INBOUND';
}

/**
 * Ingest one history-sync message. Skips automations — metadata.source = history_sync.
 * Does not emit realtime (bulk backfill would flood clients).
 */
async function ingestHistoryMessage(
  whatsappNumber: Pick<WhatsappNumber, 'id' | 'organizationId' | 'phoneNumber'>,
  msg: Record<string, unknown>,
  threadContactPhone: string
): Promise<boolean> {
  const metaMessageId = msg.id as string | undefined;
  if (!metaMessageId) return false;

  const from = normalizePhoneIdentity((msg.from as string) || '');
  const to = normalizePhoneIdentity((msg.to as string) || threadContactPhone);
  const direction = resolveDirection(from || to, whatsappNumber.phoneNumber);
  const contactPhone = direction === 'OUTBOUND' ? to : from || threadContactPhone;
  if (!contactPhone) return false;

  const parsed = parseInboundMessage(msg);
  const inboundTimestamp = parseMetaTimestamp(msg.timestamp);
  const historyContext = msg.history_context as { status?: string } | undefined;
  const orgId = whatsappNumber.organizationId;

  let contact = await prisma.contact.findFirst({
    where: {
      organizationId: orgId,
      whatsappNumberId: whatsappNumber.id,
      normalizedPhone: contactPhone,
    },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        organizationId: orgId,
        whatsappNumberId: whatsappNumber.id,
        phone: contactPhone,
        normalizedPhone: contactPhone,
        name: contactPhone,
        source: 'INBOUND',
      },
    });
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      organizationId: orgId,
      contactId: contact.id,
      whatsappNumberId: whatsappNumber.id,
    },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        organizationId: orgId,
        contactId: contact.id,
        whatsappNumberId: whatsappNumber.id,
      },
    });
  }

  const metadata: Record<string, unknown> = {
    source: 'history_sync',
    ...(parsed.metadata as Record<string, unknown> | undefined),
  };

  try {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        metaMessageId,
        direction,
        type: mapCoexistenceMessageType(msg.type as string | undefined),
        content: parsed.content || '[message]',
        status: mapHistoryStatus(historyContext?.status),
        metadata: metadata as Prisma.InputJsonValue,
        ...(inboundTimestamp ? { createdAt: inboundTimestamp } : {}),
      },
    });

    if (inboundTimestamp) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: inboundTimestamp },
      });
    }

    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      log.info('Duplicate history message skipped', { metaMessageId, organizationId: orgId });
      return false;
    }
    throw err;
  }
}

/** Track history sync chunk progress and ingest past messages into Inbox. */
export async function processHistorySync(
  whatsappNumber: Pick<WhatsappNumber, 'id' | 'organizationId' | 'phoneNumber'>,
  value: Record<string, unknown>
): Promise<number> {
  const chunks = (value.history as Array<Record<string, unknown>>) || [];
  if (chunks.length === 0) return 0;

  let maxProgress = 0;
  let declined = false;
  let saved = 0;

  for (const chunk of chunks) {
    const errors = chunk.errors as Array<{ code?: number }> | undefined;
    if (errors?.some((e) => e.code === HISTORY_DECLINED_CODE)) {
      declined = true;
      break;
    }

    const meta = chunk.metadata as { progress?: number; phase?: number } | undefined;
    if (typeof meta?.progress === 'number') {
      maxProgress = Math.max(maxProgress, meta.progress);
    }

    const threads = (chunk.threads as Array<Record<string, unknown>>) || [];
    for (const thread of threads) {
      const threadId = normalizePhoneIdentity((thread.id as string) || '');
      const messages = (thread.messages as Array<Record<string, unknown>>) || [];
      for (const msg of messages) {
        if (await ingestHistoryMessage(whatsappNumber, msg, threadId)) {
          saved += 1;
        }
      }
    }
  }

  const data: {
    historySyncProgress?: number;
    coexistenceStatus?: string;
  } = {};

  if (declined) {
    data.coexistenceStatus = 'history_declined';
    log.info('History sync declined by business', {
      organizationId: whatsappNumber.organizationId,
      whatsappNumberId: whatsappNumber.id,
    });
  } else if (maxProgress > 0) {
    data.historySyncProgress = maxProgress;
    if (maxProgress >= 100) {
      data.coexistenceStatus = 'active';
    }
  }

  if (Object.keys(data).length > 0) {
    await prisma.whatsappNumber.update({
      where: { id: whatsappNumber.id },
      data,
    });
  }

  log.info('History sync processed', {
    organizationId: whatsappNumber.organizationId,
    whatsappNumberId: whatsappNumber.id,
    progress: data.historySyncProgress,
    declined,
    messagesSaved: saved,
  });

  return saved;
}
