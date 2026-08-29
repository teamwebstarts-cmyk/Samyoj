import prisma from '../../../config/database';
import { createModuleLogger } from '../../../utils/logger';
import { normalizePhoneIdentity } from '../../../utils/phone';
import type { WhatsappNumber } from '@prisma/client';

const log = createModuleLogger('coexistence-contacts');

/** Upsert contacts from smb_app_state_sync scoped by whatsappNumberId. */
export async function processAppStateSync(
  whatsappNumber: Pick<WhatsappNumber, 'id' | 'organizationId'>,
  value: Record<string, unknown>
): Promise<number> {
  const items = (value.state_sync as Array<Record<string, unknown>>) || [];
  if (items.length === 0) return 0;

  const orgId = whatsappNumber.organizationId;
  let upserted = 0;

  for (const item of items) {
    if (item.type !== 'contact') continue;
    const contactPayload = item.contact as
      | { full_name?: string; first_name?: string; phone_number?: string }
      | undefined;
    const phone = normalizePhoneIdentity(contactPayload?.phone_number || '');
    if (!phone) continue;

    const name =
      contactPayload?.full_name?.trim() ||
      contactPayload?.first_name?.trim() ||
      phone;

    await prisma.contact.upsert({
      where: {
        organizationId_whatsappNumberId_normalizedPhone: {
          organizationId: orgId,
          whatsappNumberId: whatsappNumber.id,
          normalizedPhone: phone,
        },
      },
      create: {
        organizationId: orgId,
        whatsappNumberId: whatsappNumber.id,
        phone,
        normalizedPhone: phone,
        name,
        source: 'INBOUND',
      },
      update: name ? { name } : {},
    });
    upserted += 1;
  }

  if (upserted > 0) {
    log.info('App state contacts synced', {
      organizationId: orgId,
      whatsappNumberId: whatsappNumber.id,
      count: upserted,
    });
  }

  return upserted;
}
