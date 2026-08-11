import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { emitToOrg } from '../../realtime';
import { createModuleLogger } from '../../utils/logger';
import { parseMetaTimestamp } from '../campaigns/safety';
import { createHash } from 'node:crypto';

const log = createModuleLogger('webhook-dispatcher');

function stableValue(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableValue(item)}`)
    .join(',')}}`;
}

export function providerWebhookEventKey(
  entryId: string | undefined,
  field: string,
  value: Record<string, unknown>
): string {
  const explicit = value.event_id || value.eventId;
  if (typeof explicit === 'string' && explicit) return `${field}:${explicit}`;
  return `${entryId || 'unknown'}:${field}:${createHash('sha256').update(stableValue(value)).digest('hex')}`;
}

async function claimProviderWebhookEvent(
  organizationId: string,
  eventKey: string,
  field: string
): Promise<boolean> {
  try {
    await prisma.providerWebhookEvent.create({
      data: { organizationId, eventKey, field },
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false;
    }
    throw error;
  }
}

export const HANDLED_FIELDS = new Set([
  'message_template_status_update',
  'message_template_quality_update',
  'message_template_components_update',
  'template_category_update',
  'phone_number_quality_update',
  'phone_number_name_update',
  'business_capability_update',
  'user_preferences',
  'account_alerts',
]);

async function resolveOrgFromWaba(wabaId: string | undefined) {
  if (!wabaId) return null;
  const number = await prisma.whatsappNumber.findFirst({
    where: { wabaId, isActive: true },
    select: { organizationId: true, id: true },
  });
  return number;
}

async function resolveOrgFromPhoneNumberId(phoneNumberId: string | undefined) {
  if (!phoneNumberId) return null;
  const number = await prisma.whatsappNumber.findFirst({
    where: { phoneNumberId, isActive: true },
    select: { organizationId: true, id: true },
  });
  return number;
}

async function appendOrgAlert(
  organizationId: string,
  alertType: string,
  alert: Record<string, unknown>
) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as Record<string, unknown>) || {};
  const alerts = (settings.alerts as Record<string, unknown[]>) || {};
  const existing = (alerts[alertType] as Record<string, unknown>[]) || [];

  const entry = { ...alert, createdAt: new Date().toISOString() };
  const updated = [entry, ...existing].slice(0, 20);

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: {
        ...settings,
        alerts: { ...alerts, [alertType]: updated },
      } as object,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      action: 'whatsapp.provider_webhook_state',
      resource: 'whatsapp',
      details: { alertType, alert } as object,
    },
  });
  emitToOrg(organizationId, 'alert:new', { type: alertType, alert: entry });
}

async function handleTemplateStatusUpdate(
  value: Record<string, unknown>,
  wabaId: string | undefined
) {
  const number = await resolveOrgFromWaba(wabaId);
  if (!number) return;

  const event = (value.event as string) || '';
  const templateName = (value.message_template_name as string) || (value.name as string);
  const reason = (value.reason as string) || (value.rejected_reason as string);
  const templateId = value.message_template_id as string | undefined;

  log.info('Template status update', {
    organizationId: number.organizationId,
    event,
    templateName,
  });

  emitToOrg(number.organizationId, 'template:status', {
    templateId,
    templateName,
    event,
    reason,
  });

  if (['REJECTED', 'PAUSED', 'DISABLED', 'FLAGGED'].includes(event.toUpperCase())) {
    await appendOrgAlert(number.organizationId, 'templateRejections', {
      templateId,
      templateName,
      status: event,
      reason,
      severity: event.toUpperCase() === 'REJECTED' ? 'error' : 'warning',
    });
  }

  await appendOrgAlert(number.organizationId, 'templateStatus', {
    templateId,
    templateName,
    status: event || undefined,
    reason,
    field: 'message_template_status_update',
  });
}

async function handlePhoneNumberQualityUpdate(value: Record<string, unknown>) {
  const phoneNumberId =
    (value.phone_number_id as string) ||
    (value.id as string);

  const metadata = value as { current_limit?: string; quality_rating?: string };
  const qualityRating = metadata.quality_rating || (value.event as string);

  const number = await resolveOrgFromPhoneNumberId(
    typeof phoneNumberId === 'string' && phoneNumberId.length < 20
      ? phoneNumberId
      : (value.phone_number_id as string)
  );
  if (!number) return;

  if (qualityRating) {
    await prisma.whatsappNumber.update({
      where: { id: number.id },
      data: { qualityRating: String(qualityRating).toUpperCase() },
    });
  }

  const rating = String(qualityRating || '').toUpperCase();
  if (rating === 'YELLOW' || rating === 'RED') {
    await appendOrgAlert(number.organizationId, 'qualityRating', {
      phoneNumberId: number.id,
      qualityRating: rating,
      currentLimit: metadata.current_limit,
      severity: rating === 'RED' ? 'error' : 'warning',
    });
  }

  emitToOrg(number.organizationId, 'whatsapp:quality', {
    qualityRating: rating,
    currentLimit: metadata.current_limit,
  });
}

async function handleAccountStateUpdate(
  value: Record<string, unknown>,
  wabaId: string | undefined,
  field: string
) {
  const number = await resolveOrgFromWaba(wabaId);
  if (!number) return;
  const safeState = {
    field,
    event: typeof value.event === 'string' ? value.event : undefined,
    status: typeof value.status === 'string' ? value.status : undefined,
    currentLimit: typeof value.current_limit === 'string' ? value.current_limit : undefined,
    maxLimit: typeof value.max_limit === 'string' ? value.max_limit : undefined,
    restriction: typeof value.restriction === 'string' ? value.restriction : undefined,
    qualityRating: typeof value.quality_rating === 'string' ? value.quality_rating : undefined,
    updatedAt: new Date().toISOString(),
  };
  await appendOrgAlert(number.organizationId, field === 'user_preferences' ? 'marketingPreferences' : 'whatsappState', safeState);
  emitToOrg(number.organizationId, 'whatsapp:state', safeState);
}

function preferenceEntries(value: Record<string, unknown>) {
  const nested = Array.isArray(value.user_preferences) ? value.user_preferences : [value];
  return nested.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
}

async function handleUserPreferences(value: Record<string, unknown>, wabaId: string | undefined) {
  const number = await resolveOrgFromWaba(wabaId);
  if (!number) return;

  for (const preference of preferenceEntries(value)) {
    const phone = (
      preference.wa_id ||
      preference.phone ||
      preference.phone_number ||
      preference.user_phone
    ) as string | undefined;
    const category = String(
      preference.preference_category || preference.category || preference.preference || ''
    ).toLowerCase();
    const preferenceValue = preference.value ?? preference.opted_in ?? preference.opt_in;
    const optedOut = category.includes('marketing') && (
      preferenceValue === false ||
      ['false', 'opt_out', 'opted_out', 'unsubscribe', 'unsubscribed'].includes(String(preferenceValue).toLowerCase())
    );
    if (!phone || !optedOut) continue;

    const occurredAt = parseMetaTimestamp(
      preference.timestamp ?? preference.event_timestamp ?? preference.occurred_at
    );
    // Fail closed: a provider opt-out without a trustworthy event time cannot
    // safely win over a newer START/consent decision.
    if (!occurredAt) continue;
    const providerEventId = typeof preference.event_id === 'string'
      ? preference.event_id
      : typeof preference.id === 'string' ? preference.id : undefined;
    const decision = {
      type: 'OPT_OUT',
      optedIn: false,
      source: 'META_USER_PREFERENCES',
      category,
      event: preference,
      ...(providerEventId ? { eventId: providerEventId } : {}),
      occurredAt: occurredAt.toISOString(),
    };
    const updated = await prisma.contact.updateMany({
      where: {
        organizationId: number.organizationId,
        phone,
        OR: [{ consentAt: null }, { consentAt: { lte: occurredAt } }],
      },
      data: {
        optedIn: false,
        optOutAt: occurredAt,
        consentSource: 'META_USER_PREFERENCES',
        consentAt: occurredAt,
        consentVersion: 'meta-user-preferences-v1',
        consentDecision: decision as Prisma.InputJsonValue,
      },
    });
    await prisma.auditLog.create({
      data: {
        organizationId: number.organizationId,
        action: 'whatsapp.user_marketing_opt_out',
        resource: 'contact',
        details: {
          phone,
          category,
          updatedContact: updated.count === 1,
          source: 'META_USER_PREFERENCES',
          event: preference,
        } as object,
      },
    });
    await appendOrgAlert(number.organizationId, 'marketingPreferences', {
      phone,
      category,
      optedIn: false,
      source: 'META_USER_PREFERENCES',
    });
  }
}

async function handleAccountAlerts(value: Record<string, unknown>, wabaId: string | undefined) {
  const number = await resolveOrgFromWaba(wabaId);
  if (!number) return;

  const alertType = (value.alert_type as string) || (value.event as string) || 'unknown';
  const alertData = (value.alert_data as Record<string, unknown>) || value;

  log.warn('Account alert received', {
    organizationId: number.organizationId,
    alertType,
  });

  await appendOrgAlert(number.organizationId, 'accountAlerts', {
    alertType,
    data: alertData,
    severity: 'warning',
  });

  emitToOrg(number.organizationId, 'whatsapp:account-alert', { alertType, data: alertData });
}

export async function dispatchNonMessageWebhookFields(
  payload: Record<string, unknown>
): Promise<void> {
  if (payload.object !== 'whatsapp_business_account') return;

  for (const entry of (payload.entry as Array<Record<string, unknown>>) || []) {
    const wabaId = entry.id as string | undefined;

    for (const change of (entry.changes as Array<Record<string, unknown>>) || []) {
      const field = change.field as string;
      if (!HANDLED_FIELDS.has(field)) continue;

      const value = (change.value as Record<string, unknown>) || {};
      const number = field === 'phone_number_quality_update'
        ? await resolveOrgFromPhoneNumberId(value.phone_number_id as string)
        : await resolveOrgFromWaba(wabaId);
      if (number && !await claimProviderWebhookEvent(
        number.organizationId,
        providerWebhookEventKey(wabaId, field, value),
        field
      )) {
        log.info('Duplicate provider webhook skipped', { field, organizationId: number.organizationId });
        continue;
      }

      if (field === 'message_template_status_update') {
        await handleTemplateStatusUpdate(value, wabaId);
      } else if (field === 'message_template_quality_update') {
        await handleTemplateStatusUpdate(value, wabaId);
      } else if (field === 'message_template_components_update' || field === 'template_category_update') {
        const number = await resolveOrgFromWaba(wabaId);
        if (number) {
          await appendOrgAlert(number.organizationId, 'templateStatus', {
            field,
            templateId: value.message_template_id || value.template_id,
            templateName: value.message_template_name || value.name,
            previousCategory: value.previous_category,
            category: value.new_category || value.category,
            components: value.components,
          });
        }
      } else if (field === 'phone_number_quality_update') {
        await handlePhoneNumberQualityUpdate(value);
      } else if (field === 'account_alerts') {
        await handleAccountAlerts(value, wabaId);
      } else if (field === 'user_preferences') {
        await handleUserPreferences(value, wabaId);
      } else {
        await handleAccountStateUpdate(value, wabaId, field);
      }
    }
  }
}
