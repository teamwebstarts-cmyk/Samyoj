import prisma from '../../config/database';
import { emitToOrg } from '../../realtime';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('webhook-dispatcher');

const HANDLED_FIELDS = new Set([
  'message_template_status_update',
  'phone_number_quality_update',
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
}

async function handlePhoneNumberQualityUpdate(value: Record<string, unknown>) {
  const phoneNumberId =
    (value.display_phone_number as string) ||
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

      if (field === 'message_template_status_update') {
        await handleTemplateStatusUpdate(value, wabaId);
      } else if (field === 'phone_number_quality_update') {
        await handlePhoneNumberQualityUpdate(value);
      } else if (field === 'account_alerts') {
        await handleAccountAlerts(value, wabaId);
      }
    }
  }
}
