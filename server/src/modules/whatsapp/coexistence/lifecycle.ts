import prisma from '../../../config/database';
import { emitToOrg } from '../../../realtime';
import { createModuleLogger } from '../../../utils/logger';
import type { WhatsappNumber } from '@prisma/client';

const log = createModuleLogger('coexistence-lifecycle');

/** account_update lifecycle: offboard / reconnect / partner removed. */
export async function processAccountUpdate(
  whatsappNumber: Pick<WhatsappNumber, 'id' | 'organizationId' | 'phoneNumber'>,
  value: Record<string, unknown>,
  wabaId?: string
): Promise<void> {
  const event = ((value.event as string) || '').toUpperCase();
  if (!event) return;

  const orgId = whatsappNumber.organizationId;
  const now = new Date();

  if (event === 'ACCOUNT_OFFBOARDED') {
    await prisma.whatsappNumber.update({
      where: { id: whatsappNumber.id },
      data: {
        isOnBizApp: false,
        coexistenceStatus: 'offboarded',
        coexistenceOffboardedAt: now,
      },
    });
    emitToOrg(orgId, 'whatsapp:coexistence-offboarded', {
      whatsappNumberId: whatsappNumber.id,
      phoneNumber: whatsappNumber.phoneNumber,
    });
    log.warn('Coexistence offboarded', { organizationId: orgId, wabaId });
    return;
  }

  if (event === 'ACCOUNT_RECONNECTED') {
    await prisma.whatsappNumber.update({
      where: { id: whatsappNumber.id },
      data: {
        isOnBizApp: true,
        coexistenceStatus: 'active',
        coexistenceOffboardedAt: null,
      },
    });
    emitToOrg(orgId, 'whatsapp:coexistence-reconnected', {
      whatsappNumberId: whatsappNumber.id,
    });
    return;
  }

  if (event === 'PARTNER_REMOVED') {
    await prisma.whatsappNumber.update({
      where: { id: whatsappNumber.id },
      data: {
        coexistenceStatus: 'partner_removed',
        coexistenceOffboardedAt: now,
      },
    });
    emitToOrg(orgId, 'whatsapp:partner-removed', {
      whatsappNumberId: whatsappNumber.id,
      phoneNumber: value.phone_number,
    });
  }
}
