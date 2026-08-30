import prisma from '../../../config/database';
import { createModuleLogger } from '../../../utils/logger';
import {
  claimProviderWebhookEvent,
  completeProviderWebhookEvent,
  providerPhoneNumberId,
  releaseProviderWebhookEvent,
} from '../webhook-dispatcher';
import { processMessageEchoes } from './echoes';
import { processHistorySync } from './history';
import { processAppStateSync } from './contacts-sync';
import { processAccountUpdate } from './lifecycle';
import { coexistenceWebhookEventKey } from './event-key';
import type { WhatsappNumber } from '@prisma/client';

const log = createModuleLogger('coexistence');

const COEXISTENCE_FIELDS = new Set([
  'history',
  'smb_message_echoes',
  'smb_app_state_sync',
  'account_update',
]);

export { COEXISTENCE_FIELDS, coexistenceWebhookEventKey };

/**
 * Resolve the active WhatsApp number for a coexistence webhook.
 * Fail closed: never pick "latest" when phone_number_id is missing and 2+
 * numbers share the WABA. If phone_number_id is present but unmatched, do
 * not fall back to another number on the same WABA.
 */
export async function resolveCoexistenceWhatsappNumber(
  wabaId: string | undefined,
  value: Record<string, unknown>
): Promise<WhatsappNumber | null> {
  const providerIdentity = providerPhoneNumberId(value);
  if (providerIdentity.ambiguous) {
    log.warn('Coexistence webhook has conflicting phone number identities', { wabaId });
    return null;
  }

  if (providerIdentity.phoneNumberId) {
    return prisma.whatsappNumber.findFirst({
      where: {
        ...(wabaId ? { wabaId } : {}),
        phoneNumberId: providerIdentity.phoneNumberId,
        isActive: true,
      },
    });
  }

  if (!wabaId) return null;

  const candidates = await prisma.whatsappNumber.findMany({
    where: { wabaId, isActive: true },
    take: 2,
  });
  if (candidates.length !== 1) {
    log.warn('Coexistence WABA-only webhook is ambiguous; refusing to route it', {
      wabaId,
      activeNumberCount: candidates.length,
    });
    return null;
  }
  return candidates[0];
}

export async function processCoexistenceWebhookFields(
  payload: Record<string, unknown>
): Promise<void> {
  if (payload.object !== 'whatsapp_business_account') return;

  for (const entry of (payload.entry as Array<Record<string, unknown>>) || []) {
    const wabaId = entry.id as string | undefined;
    const entryTime = entry.time;

    for (const change of (entry.changes as Array<Record<string, unknown>>) || []) {
      const field = change.field as string;
      if (!COEXISTENCE_FIELDS.has(field)) continue;

      const value = (change.value as Record<string, unknown>) || {};
      const whatsappNumber = await resolveCoexistenceWhatsappNumber(wabaId, value);

      if (!whatsappNumber) {
        const phoneIdentity = providerPhoneNumberId(value);
        log.warn('No active number for coexistence webhook', {
          field,
          phoneNumberId: phoneIdentity.phoneNumberId,
          wabaId,
          ambiguous: phoneIdentity.ambiguous,
        });
        continue;
      }

      const eventKey = coexistenceWebhookEventKey({
        field,
        wabaId,
        phoneNumberId: whatsappNumber.phoneNumberId,
        entryTime,
        value,
      });
      if (!(await claimProviderWebhookEvent(whatsappNumber.organizationId, eventKey, field))) {
        log.info('Duplicate coexistence webhook skipped', {
          field,
          organizationId: whatsappNumber.organizationId,
        });
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
              accessToken: whatsappNumber.accessToken,
            },
            value
          );
        } else if (field === 'smb_app_state_sync') {
          await processAppStateSync(whatsappNumber, value);
        } else if (field === 'account_update') {
          await processAccountUpdate(whatsappNumber, value, wabaId);
        }
        await completeProviderWebhookEvent(whatsappNumber.organizationId, eventKey);
      } catch (err) {
        await releaseProviderWebhookEvent(whatsappNumber.organizationId, eventKey);
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
