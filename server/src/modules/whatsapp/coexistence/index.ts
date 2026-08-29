import prisma from '../../../config/database';
import { createModuleLogger } from '../../../utils/logger';
import { processMessageEchoes } from './echoes';
import { processHistorySync } from './history';
import { processAppStateSync } from './contacts-sync';
import { processAccountUpdate } from './lifecycle';

const log = createModuleLogger('coexistence');

const COEXISTENCE_FIELDS = new Set([
  'history',
  'smb_message_echoes',
  'smb_app_state_sync',
  'account_update',
]);

export { COEXISTENCE_FIELDS };

export async function processCoexistenceWebhookFields(
  payload: Record<string, unknown>
): Promise<void> {
  if (payload.object !== 'whatsapp_business_account') return;

  for (const entry of (payload.entry as Array<Record<string, unknown>>) || []) {
    const wabaId = entry.id as string | undefined;

    for (const change of (entry.changes as Array<Record<string, unknown>>) || []) {
      const field = change.field as string;
      if (!COEXISTENCE_FIELDS.has(field)) continue;

      const value = (change.value as Record<string, unknown>) || {};
      const phoneNumberId = (value.metadata as { phone_number_id?: string } | undefined)
        ?.phone_number_id;

      let whatsappNumber = phoneNumberId
        ? await prisma.whatsappNumber.findFirst({
            where: { phoneNumberId, isActive: true },
          })
        : null;

      if (!whatsappNumber && wabaId) {
        const candidates = await prisma.whatsappNumber.findMany({
          where: { wabaId, isActive: true },
          take: 2,
        });
        if (candidates.length === 1) whatsappNumber = candidates[0];
      }

      if (!whatsappNumber) {
        log.warn('No active number for coexistence webhook', { field, phoneNumberId, wabaId });
        continue;
      }

      try {
        if (field === 'smb_message_echoes') {
          await processMessageEchoes(whatsappNumber, value);
        } else if (field === 'history') {
          await processHistorySync(
            {
              id: whatsappNumber.id,
              organizationId: whatsappNumber.organizationId,
              phoneNumber: whatsappNumber.phoneNumber,
            },
            value
          );
        } else if (field === 'smb_app_state_sync') {
          await processAppStateSync(whatsappNumber, value);
        } else if (field === 'account_update') {
          await processAccountUpdate(whatsappNumber, value, wabaId);
        }
      } catch (err) {
        log.warn('Coexistence webhook handler failed', {
          field,
          organizationId: whatsappNumber.organizationId,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }
  }
}
