import { Prisma } from '@prisma/client';
import prisma from '../../../config/database';
import { parseInboundMessage } from '../../inbox/message-parser';
import { emitToOrg } from '../../../realtime';
import { createModuleLogger } from '../../../utils/logger';
import { parseMetaTimestamp } from '../../campaigns/safety';
import { normalizePhoneIdentity } from '../../../utils/phone';
import type { WhatsappNumber } from '@prisma/client';
import { mapCoexistenceMessageType } from './message-type';

const log = createModuleLogger('coexistence-echoes');

/**
 * Ingest smb_message_echoes as OUTBOUND messages (sent from Business app).
 * Skips automations — caller must not trigger automation engine on echoes.
 */
export async function processMessageEchoes(
  whatsappNumber: Pick<WhatsappNumber, 'id' | 'organizationId' | 'phoneNumber'>,
  value: Record<string, unknown>
): Promise<number> {
  const echoes = (value.message_echoes as Array<Record<string, unknown>>) || [];
  if (echoes.length === 0) return 0;

  const orgId = whatsappNumber.organizationId;
  let saved = 0;

  for (const msg of echoes) {
    const metaMessageId = msg.id as string | undefined;
    const contactPhone = normalizePhoneIdentity((msg.to as string) || '');
    if (!metaMessageId || !contactPhone) continue;

    const parsed = parseInboundMessage(msg);
    const inboundTimestamp = parseMetaTimestamp(msg.timestamp);

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

    const echoType = mapCoexistenceMessageType(msg.type as string | undefined);
    const metadata: Record<string, unknown> = {
      source: 'biz_app',
      ...(parsed.metadata as Record<string, unknown> | undefined),
    };

    try {
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          metaMessageId,
          direction: 'OUTBOUND',
          type: echoType,
          content: parsed.content || '[message]',
          status: 'DELIVERED',
          metadata: metadata as Prisma.InputJsonValue,
          createdAt: inboundTimestamp,
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: inboundTimestamp },
      });

      emitToOrg(orgId, 'message:new', {
        conversationId: conversation.id,
        message,
        contact,
      });
      saved += 1;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        log.info('Duplicate echo skipped', { metaMessageId, organizationId: orgId });
        continue;
      }
      throw err;
    }
  }

  return saved;
}
