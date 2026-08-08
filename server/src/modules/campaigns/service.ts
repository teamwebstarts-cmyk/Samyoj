import prisma from '../../config/database';
import { broadcastQueue } from '../../config/queues';
import { AppError } from '../../utils/response';
import { emitToOrg } from '../../realtime';
import { getOrgWhatsappContext, getWhatsappContextById } from '../whatsapp/context';
import { getTemplateDisplayText, MetaWhatsAppService } from '../whatsapp/meta.service';
import { resolveMetaCredentials } from '../whatsapp/org-meta.service';
import { logCampaignAudit } from './audit';
import { assertDailySendQuota, assertDailyBudget, getCampaignSettings } from './quota';
import {
  applyTemplateParamsToPreview,
  buildTemplateComponents,
  mergeTemplateParams,
} from './template-params';
import type {
  AudienceConfig,
  AudienceType,
  TemplateParams,
} from './types';
import { dedupeRecipients, hasAuditableCampaignConsent, type ResolvedRecipient } from './recipients';
import type { Campaign, CampaignRecipient, CampaignStatus, Prisma } from '@prisma/client';

const EDITABLE_STATUSES: CampaignStatus[] = ['DRAFT', 'SCHEDULED'];
const STUCK_RUNNING_MS = 6 * 60 * 60 * 1000;

export type { ResolvedRecipient };
export { dedupeRecipients };

export async function resolveAudienceRecipients(
  organizationId: string,
  audienceType: AudienceType,
  audienceConfig: AudienceConfig | null | undefined,
  manualRecipients: ResolvedRecipient[] = []
): Promise<ResolvedRecipient[]> {
  if (audienceType === 'MANUAL') {
    const deduped = dedupeRecipients(manualRecipients);
    if (!deduped.length) return deduped;
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId,
        phone: { in: deduped.map((recipient) => recipient.phone) },
        optedIn: true,
        consentSource: { not: null },
        consentAt: { not: null },
      },
      select: { phone: true },
    });
    const optedIn = new Set(contacts.map((contact) => contact.phone));
    return deduped.filter((recipient) => optedIn.has(recipient.phone));
  }

  const contactWhere: Prisma.ContactWhereInput = { organizationId };
  // Broadcasts are always fail-closed. The legacy requireOptIn=false input is
  // intentionally ignored so API callers cannot bypass consent policy.
  contactWhere.optedIn = true;
  contactWhere.consentSource = { not: null };
  contactWhere.consentAt = { not: null };

  if (audienceType === 'TAGS') {
    const tags = audienceConfig?.tags?.filter(Boolean) || [];
    if (!tags.length) throw new AppError(400, 'At least one tag is required for tag-based audience');
    contactWhere.tags = { hasSome: tags };
  } else if (audienceType === 'CONTACTS') {
    const contactIds = audienceConfig?.contactIds?.filter(Boolean) || [];
    if (!contactIds.length) throw new AppError(400, 'At least one contact is required');
    contactWhere.id = { in: contactIds };
  } else if (audienceType === 'ALL_OPTED_IN') {
    contactWhere.optedIn = true;
  }

  const contacts = await prisma.contact.findMany({
    where: contactWhere,
    select: { phone: true, name: true, consentSource: true, consentAt: true },
  });

  return dedupeRecipients(
    contacts.map((c) => ({
      phone: c.phone,
      name: c.name ?? undefined,
      variables: undefined,
    }))
  );
}

export async function syncRunningCampaignStatuses(organizationId: string) {
  const running = await prisma.campaign.findMany({
    where: { organizationId, status: { in: ['RUNNING', 'PAUSED'] } },
    select: { id: true, updatedAt: true },
  });

  for (const campaign of running) {
    await recoverStuckCampaign(campaign.id, campaign.updatedAt);
    await finalizeCampaignIfDone(campaign.id);
  }
}

async function recoverStuckCampaign(campaignId: string, updatedAt: Date) {
  const age = Date.now() - updatedAt.getTime();
  if (age < STUCK_RUNNING_MS) return;

  const pending = await prisma.campaignRecipient.count({
    where: { campaignId, status: 'PENDING' },
  });
  if (pending === 0) return;

  await prisma.campaignRecipient.updateMany({
    where: { campaignId, status: 'PENDING' },
    data: {
      status: 'FAILED',
      errorMessage: 'Timed out — batch job did not complete',
    },
  });

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { failedCount: { increment: pending } },
  });
}

export async function finalizeCampaignIfDone(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { recipients: true },
  });

  if (!campaign || !['RUNNING', 'PAUSED'].includes(campaign.status)) return;

  const pending = campaign.recipients.filter((r) => r.status === 'PENDING').length;
  if (pending > 0) return;

  const allFailed = campaign.failedCount >= campaign.totalContacts;
  const status: CampaignStatus = allFailed ? 'FAILED' : 'COMPLETED';

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status, pausedAt: null },
  });

  emitToOrg(campaign.organizationId, 'campaign:status', { campaignId, status });

  if (status === 'COMPLETED') {
    const owner = await prisma.organizationUser.findFirst({
      where: { organizationId: campaign.organizationId, role: 'OWNER' },
      include: { user: { select: { email: true } } },
    });
    if (owner?.user.email) {
      const { notifyCampaignComplete } = await import('../../services/notification.service');
      void notifyCampaignComplete(campaign.organizationId, owner.user.email, campaign.name, {
        sent: campaign.sentCount,
        delivered: campaign.deliveredCount,
        failed: campaign.failedCount,
      });
    }
  }
}

export async function syncCampaignRecipientFromWebhook(
  metaMessageId: string,
  status: string
) {
  const normalized = status.toUpperCase();
  if (!['DELIVERED', 'READ', 'FAILED'].includes(normalized)) return;

  const recipient = await prisma.campaignRecipient.findUnique({
    where: { metaMessageId },
    include: { campaign: true },
  });
  if (!recipient) return;

  const now = new Date();
  const data: Prisma.CampaignRecipientUpdateInput = {};

  if (normalized === 'DELIVERED' && !['DELIVERED', 'READ', 'FAILED'].includes(recipient.status)) {
    data.status = 'DELIVERED';
    data.deliveredAt = now;
  } else if (normalized === 'READ' && recipient.status !== 'READ' && recipient.status !== 'FAILED') {
    data.status = 'READ';
    data.readAt = now;
    if (!recipient.deliveredAt) data.deliveredAt = now;
  } else if (normalized === 'FAILED' && !['DELIVERED', 'READ', 'FAILED'].includes(recipient.status)) {
    data.status = 'FAILED';
    data.errorMessage = 'Delivery failed (Meta webhook)';
  }

  await prisma.$transaction(async (tx) => {
    const prev = recipient.status;
    if (!Object.keys(data).length) return;
    const changed = await tx.campaignRecipient.updateMany({
      where: { id: recipient.id, status: prev },
      data,
    });
    if (changed.count !== 1) return;

    const campaignUpdate: Prisma.CampaignUpdateInput = {};
    if (normalized === 'DELIVERED' && prev !== 'DELIVERED' && prev !== 'READ') {
      campaignUpdate.deliveredCount = { increment: 1 };
    }
    if (normalized === 'READ' && prev !== 'READ') {
      campaignUpdate.readCount = { increment: 1 };
      if (prev !== 'DELIVERED') {
        campaignUpdate.deliveredCount = { increment: 1 };
      }
    }
    if (normalized === 'FAILED' && prev !== 'FAILED') {
      campaignUpdate.failedCount = { increment: 1 };
      if (prev === 'SENT' || prev === 'DELIVERED' || prev === 'READ') {
        if (prev === 'SENT') campaignUpdate.sentCount = { decrement: 1 };
        if (prev === 'DELIVERED' || prev === 'READ') {
          campaignUpdate.deliveredCount = { decrement: 1 };
        }
        if (prev === 'READ') campaignUpdate.readCount = { decrement: 1 };
      }
    }

    if (Object.keys(campaignUpdate).length) {
      await tx.campaign.update({ where: { id: recipient.campaignId }, data: campaignUpdate });
    }
  });

  emitToOrg(recipient.campaign.organizationId, 'campaign:progress', {
    campaignId: recipient.campaignId,
    recipientId: recipient.id,
    status: normalized,
  });
}

async function getWhatsappForCampaign(orgId: string, whatsappNumberId?: string | null) {
  if (whatsappNumberId) {
    return getWhatsappContextById(orgId, whatsappNumberId);
  }
  return getOrgWhatsappContext(orgId);
}

async function validateTemplate(orgId: string, templateName: string, wabaId: string, accessToken: string) {
  const template = await MetaWhatsAppService.getMessageTemplate(wabaId, accessToken, templateName);
  if (!template) {
    throw new AppError(
      400,
      `Template "${templateName}" not found or not approved on your WhatsApp account.`
    );
  }
  if (template.status !== 'APPROVED') {
    throw new AppError(400, `Template "${templateName}" is not approved (status: ${template.status}).`);
  }
  return template;
}

export async function queueCampaignSend(
  campaign: Campaign & { recipients: CampaignRecipient[] },
  userId?: string
) {
  if (campaign.status === 'RUNNING') throw new AppError(409, 'Campaign is already being sent');
  if (campaign.status === 'CANCELLED') throw new AppError(400, 'Campaign was cancelled');

  if (campaign.audienceType !== 'MANUAL') {
    const resolved = await resolveAudienceRecipients(
      campaign.organizationId,
      campaign.audienceType as AudienceType,
      campaign.audienceConfig as AudienceConfig | null,
      []
    );
    if (!resolved.length) {
      throw new AppError(400, 'No recipients match the selected audience');
    }
    await persistRecipients(campaign.id, resolved);
    const refreshed = await prisma.campaign.findFirst({
      where: { id: campaign.id },
      include: { recipients: true },
    });
    if (!refreshed) throw new AppError(404, 'Campaign not found');
    campaign = refreshed;
  }

  if (!campaign.recipients.length) {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'COMPLETED' } });
    throw new AppError(400, 'Campaign has no recipients');
  }

  await assertDailySendQuota(campaign.organizationId, campaign.recipients.length);
  await assertDailyBudget(campaign.organizationId, campaign.recipients.length, 'MARKETING');

  const { whatsappNumber, wabaId, accessToken } = await getWhatsappForCampaign(
    campaign.organizationId,
    campaign.whatsappNumberId
  );

  await MetaWhatsAppService.ensureWabaSubscribed(wabaId, accessToken, await resolveMetaCredentials(campaign.organizationId));

  const template = await validateTemplate(
    campaign.organizationId,
    campaign.templateName,
    wabaId,
    accessToken
  );
  const templateLanguage = campaign.templateLanguage || template.language || 'en_US';
  const templateParams = (campaign.templateParams as TemplateParams | null) || undefined;
  const templateContent = applyTemplateParamsToPreview(template, templateParams, campaign.templateName);

  const claimedRun = await prisma.campaign.updateMany({
    where: { id: campaign.id, status: { in: ['DRAFT', 'SCHEDULED'] } },
    data: {
      status: 'RUNNING',
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      pausedAt: null,
      cancelledAt: null,
      sentById: userId ?? null,
      templateLanguage,
    },
  });
  if (claimedRun.count !== 1) {
    throw new AppError(409, 'Campaign changed while it was being queued; try again');
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { templateLanguage },
  });

  await prisma.campaignRecipient.updateMany({
    where: { campaignId: campaign.id },
    data: {
      status: 'PENDING',
      metaMessageId: null,
      claimToken: null,
      claimedAt: null,
      errorMessage: null,
      sentAt: null,
      deliveredAt: null,
      readAt: null,
    },
  });

  const settings = await getCampaignSettings(campaign.organizationId);
  const batchSize = settings.batchSize ?? 50;
  const batchDelayMs = settings.batchDelayMs ?? 1000;
  const totalBatches = Math.ceil(campaign.recipients.length / batchSize);

  for (let i = 0; i < campaign.recipients.length; i += batchSize) {
    const batch = campaign.recipients.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);
    await broadcastQueue.add(
      'send-broadcast-batch',
      {
        campaignId: campaign.id,
        organizationId: campaign.organizationId,
        whatsappNumberDbId: whatsappNumber.id,
        phoneNumberId: whatsappNumber.phoneNumberId,
        encryptedToken: whatsappNumber.accessToken,
        wabaId,
        templateName: campaign.templateName,
        templateLanguage,
        templateContent,
        templateParams,
        recipients: batch.map((r) => ({
          id: r.id,
          phone: r.phone,
          name: r.name ?? undefined,
          variables: r.variables,
        })),
        isLastBatch: batchIndex === totalBatches - 1,
      },
      { delay: batchIndex * batchDelayMs, jobId: `campaign:${campaign.id}:batch:${batch[0].id}` }
    );
  }

  emitToOrg(campaign.organizationId, 'campaign:status', {
    campaignId: campaign.id,
    status: 'RUNNING',
  });

  return { recipientCount: campaign.recipients.length };
}

export async function sendTestMessage(
  campaign: Campaign,
  phone: string,
  userId?: string
) {
  const contact = await prisma.contact.findUnique({
    where: { organizationId_phone: { organizationId: campaign.organizationId, phone } },
    select: { optedIn: true, consentSource: true, consentAt: true },
  });
  if (!contact || !hasAuditableCampaignConsent(contact)) {
    throw new AppError(400, 'Test sends require an existing opted-in contact with recorded consent');
  }
  const { whatsappNumber, wabaId, accessToken } = await getWhatsappForCampaign(
    campaign.organizationId,
    campaign.whatsappNumberId
  );

  const template = await validateTemplate(
    campaign.organizationId,
    campaign.templateName,
    wabaId,
    accessToken
  );
  const templateLanguage = campaign.templateLanguage || template.language || 'en_US';
  const templateParams = mergeTemplateParams(
    campaign.templateParams as TemplateParams | null,
    null,
    undefined
  );
  const components = buildTemplateComponents(templateParams, template);

  const result = await MetaWhatsAppService.sendMessage(whatsappNumber.phoneNumberId, accessToken, {
    to: phone,
    type: 'template',
    template: {
      name: campaign.templateName,
      language: { code: templateLanguage },
      ...(components.length ? { components } : {}),
    },
  });

  await logCampaignAudit(campaign.organizationId, userId, 'campaign.test_send', {
    campaignId: campaign.id,
    phone,
    metaMessageId: result.messages?.[0]?.id,
  });

  return { metaMessageId: result.messages?.[0]?.id };
}

export async function pauseCampaign(campaignId: string, orgId: string, userId?: string) {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, organizationId: orgId } });
  if (!campaign) throw new AppError(404, 'Campaign not found');
  if (campaign.status !== 'RUNNING') throw new AppError(400, 'Only running campaigns can be paused');

  const updated = await prisma.campaign.updateMany({
    where: { id: campaignId, organizationId: orgId, status: 'RUNNING' },
    data: { status: 'PAUSED', pausedAt: new Date() },
  });
  if (updated.count !== 1) throw new AppError(409, 'Campaign changed before it could be paused');

  await logCampaignAudit(orgId, userId, 'campaign.pause', { campaignId });
  emitToOrg(orgId, 'campaign:status', { campaignId, status: 'PAUSED' });
}

export async function resumeCampaign(
  campaign: Campaign & { recipients: CampaignRecipient[] },
  userId?: string
) {
  if (campaign.status !== 'PAUSED') throw new AppError(400, 'Only paused campaigns can be resumed');

  const pending = campaign.recipients.filter((r) => r.status === 'PENDING');
  if (!pending.length) {
    await finalizeCampaignIfDone(campaign.id);
    throw new AppError(400, 'No pending recipients to resume');
  }

  const updated = await prisma.campaign.updateMany({
    where: { id: campaign.id, status: 'PAUSED' },
    data: { status: 'RUNNING', pausedAt: null },
  });
  if (updated.count !== 1) throw new AppError(409, 'Campaign changed before it could be resumed');

  const settings = await getCampaignSettings(campaign.organizationId);
  const batchSize = settings.batchSize ?? 50;
  const batchDelayMs = settings.batchDelayMs ?? 1000;

  const { whatsappNumber, wabaId, accessToken } = await getWhatsappForCampaign(
    campaign.organizationId,
    campaign.whatsappNumberId
  );

  const template = await validateTemplate(
    campaign.organizationId,
    campaign.templateName,
    wabaId,
    accessToken
  );
  const templateLanguage = campaign.templateLanguage || template.language || 'en_US';
  const templateParams = (campaign.templateParams as TemplateParams | null) || undefined;
  const templateContent = applyTemplateParamsToPreview(template, templateParams, campaign.templateName);

  const totalBatches = Math.ceil(pending.length / batchSize);
  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);
    await broadcastQueue.add(
      'send-broadcast-batch',
      {
        campaignId: campaign.id,
        organizationId: campaign.organizationId,
        whatsappNumberDbId: whatsappNumber.id,
        phoneNumberId: whatsappNumber.phoneNumberId,
        encryptedToken: whatsappNumber.accessToken,
        wabaId,
        templateName: campaign.templateName,
        templateLanguage,
        templateContent,
        templateParams,
        recipients: batch.map((r) => ({
          id: r.id,
          phone: r.phone,
          name: r.name ?? undefined,
          variables: r.variables,
        })),
        isLastBatch: batchIndex === totalBatches - 1,
      },
      { delay: batchIndex * batchDelayMs, jobId: `campaign:${campaign.id}:retry:${batch[0].id}` }
    );
  }

  await logCampaignAudit(campaign.organizationId, userId, 'campaign.resume', { campaignId: campaign.id });
  emitToOrg(campaign.organizationId, 'campaign:status', { campaignId: campaign.id, status: 'RUNNING' });
}

export async function cancelCampaign(campaignId: string, orgId: string, userId?: string) {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, organizationId: orgId } });
  if (!campaign) throw new AppError(404, 'Campaign not found');
  if (!['RUNNING', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) {
    throw new AppError(400, 'Campaign cannot be cancelled in its current state');
  }

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.campaign.findFirst({
      where: { id: campaignId, organizationId: orgId, status: { in: ['RUNNING', 'PAUSED', 'SCHEDULED'] } },
      select: { id: true },
    });
    if (!current) return 0;
    const pending = await tx.campaignRecipient.updateMany({
      where: { campaignId, status: 'PENDING', claimToken: null },
      data: { status: 'FAILED', errorMessage: 'Campaign cancelled' },
    });
    await tx.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        pausedAt: null,
        failedCount: { increment: pending.count },
      },
    });
    return 1;
  });
  if (!result) throw new AppError(409, 'Campaign has already changed or reached a terminal state');

  await logCampaignAudit(orgId, userId, 'campaign.cancel', { campaignId });
  emitToOrg(orgId, 'campaign:status', { campaignId, status: 'CANCELLED' });
}

export async function retryFailedRecipients(
  campaign: Campaign & { recipients: CampaignRecipient[] },
  userId?: string
) {
  const failed = campaign.recipients.filter((r) => r.status === 'FAILED');
  if (!failed.length) throw new AppError(400, 'No failed recipients to retry');

  await assertDailySendQuota(campaign.organizationId, failed.length);
  await assertDailyBudget(campaign.organizationId, failed.length, 'MARKETING');

  const retryRun = await prisma.campaign.updateMany({
    where: { id: campaign.id, status: { in: ['FAILED', 'COMPLETED', 'PAUSED'] } },
    data: {
      status: 'RUNNING',
      failedCount: { decrement: failed.length },
      pausedAt: null,
    },
  });
  if (retryRun.count !== 1) throw new AppError(409, 'Campaign changed before retry could start');

  await prisma.campaignRecipient.updateMany({
    where: { id: { in: failed.map((r) => r.id) } },
    data: {
      status: 'PENDING',
      errorMessage: null,
      metaMessageId: null,
      claimToken: null,
      claimedAt: null,
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      retryCount: { increment: 1 },
    },
  });

  const settings = await getCampaignSettings(campaign.organizationId);
  const batchSize = settings.batchSize ?? 50;
  const batchDelayMs = settings.batchDelayMs ?? 1000;

  const { whatsappNumber, wabaId, accessToken } = await getWhatsappForCampaign(
    campaign.organizationId,
    campaign.whatsappNumberId
  );

  const template = await validateTemplate(
    campaign.organizationId,
    campaign.templateName,
    wabaId,
    accessToken
  );
  const templateLanguage = campaign.templateLanguage || template.language || 'en_US';
  const templateParams = (campaign.templateParams as TemplateParams | null) || undefined;
  const templateContent = applyTemplateParamsToPreview(template, templateParams, campaign.templateName);

  const totalBatches = Math.ceil(failed.length / batchSize);
  for (let i = 0; i < failed.length; i += batchSize) {
    const batch = failed.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);
    await broadcastQueue.add(
      'send-broadcast-batch',
      {
        campaignId: campaign.id,
        organizationId: campaign.organizationId,
        whatsappNumberDbId: whatsappNumber.id,
        phoneNumberId: whatsappNumber.phoneNumberId,
        encryptedToken: whatsappNumber.accessToken,
        wabaId,
        templateName: campaign.templateName,
        templateLanguage,
        templateContent,
        templateParams,
        recipients: batch.map((r) => ({
          id: r.id,
          phone: r.phone,
          name: r.name ?? undefined,
          variables: r.variables,
        })),
        isLastBatch: batchIndex === totalBatches - 1,
      },
      { delay: batchIndex * batchDelayMs }
    );
  }

  await logCampaignAudit(campaign.organizationId, userId, 'campaign.retry_failed', {
    campaignId: campaign.id,
    count: failed.length,
  });
  emitToOrg(campaign.organizationId, 'campaign:status', { campaignId: campaign.id, status: 'RUNNING' });

  return { retriedCount: failed.length };
}

export async function duplicateCampaign(
  campaign: Campaign & { recipients: CampaignRecipient[] },
  userId?: string
) {
  const copy = await prisma.campaign.create({
    data: {
      organizationId: campaign.organizationId,
      name: `${campaign.name} (copy)`,
      templateName: campaign.templateName,
      templateLanguage: campaign.templateLanguage,
      templateParams: campaign.templateParams ?? undefined,
      audienceType: campaign.audienceType,
      audienceConfig: campaign.audienceConfig ?? undefined,
      whatsappNumberId: campaign.whatsappNumberId,
      timezone: campaign.timezone,
      status: 'DRAFT',
      totalContacts: campaign.recipients.length,
      createdById: userId ?? null,
      recipients: {
        create: campaign.recipients.map((r) => ({
          phone: r.phone,
          name: r.name,
          variables: r.variables ?? undefined,
        })),
      },
    },
    include: { recipients: true },
  });

  await logCampaignAudit(campaign.organizationId, userId, 'campaign.duplicate', {
    sourceId: campaign.id,
    newId: copy.id,
  });

  return copy;
}

export async function getCampaignAnalytics(campaignId: string, orgId: string, whatsappNumberId?: string) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      organizationId: orgId,
      ...(whatsappNumberId ? { whatsappNumberId } : {}),
    },
    include: {
      recipients: {
        select: { status: true, errorMessage: true, sentAt: true, deliveredAt: true, readAt: true },
      },
    },
  });
  if (!campaign) return null;

  const byStatus: Record<string, number> = {};
  for (const r of campaign.recipients) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }

  const errors: Record<string, number> = {};
  for (const r of campaign.recipients) {
    if (r.errorMessage) {
      errors[r.errorMessage] = (errors[r.errorMessage] || 0) + 1;
    }
  }

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      totalContacts: campaign.totalContacts,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      readCount: campaign.readCount,
      failedCount: campaign.failedCount,
    },
    deliveryRate: campaign.totalContacts
      ? ((campaign.deliveredCount / campaign.totalContacts) * 100).toFixed(1)
      : '0',
    readRate: campaign.totalContacts
      ? ((campaign.readCount / campaign.totalContacts) * 100).toFixed(1)
      : '0',
    byStatus,
    topErrors: Object.entries(errors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([message, count]) => ({ message, count })),
  };
}

export function recipientsToCsv(
  recipients: Array<{
    phone: string;
    name?: string | null;
    status: string;
    errorMessage?: string | null;
    sentAt?: Date | null;
    deliveredAt?: Date | null;
    readAt?: Date | null;
  }>
): string {
  const header = 'phone,name,status,error,sent_at,delivered_at,read_at';
  const rows = recipients.map((r) =>
    [
      r.phone,
      r.name || '',
      r.status,
      (r.errorMessage || '').replace(/"/g, '""'),
      r.sentAt?.toISOString() || '',
      r.deliveredAt?.toISOString() || '',
      r.readAt?.toISOString() || '',
    ]
      .map((v) => `"${v}"`)
      .join(',')
  );
  return [header, ...rows].join('\n');
}

export async function processScheduledCampaigns(organizationId?: string) {
  const due = await prisma.campaign.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      status: 'SCHEDULED',
      scheduledAt: { lte: new Date() },
    },
    include: { recipients: true },
  });

  for (const campaign of due) {
    try {
      await queueCampaignSend(campaign);
      await logCampaignAudit(campaign.organizationId, undefined, 'campaign.scheduled_send', {
        campaignId: campaign.id,
      });
    } catch (err) {
      await prisma.campaign.updateMany({
        where: { id: campaign.id, status: 'SCHEDULED' },
        data: { status: 'FAILED' },
      });
      await logCampaignAudit(campaign.organizationId, undefined, 'campaign.scheduled_send_failed', {
        campaignId: campaign.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function canEditCampaign(status: string) {
  return EDITABLE_STATUSES.includes(status as CampaignStatus);
}

export async function persistRecipients(
  campaignId: string,
  recipients: ResolvedRecipient[]
) {
  const deduped = dedupeRecipients(recipients);
  await prisma.$transaction([
    prisma.campaignRecipient.deleteMany({ where: { campaignId } }),
    prisma.campaignRecipient.createMany({
      data: deduped.map((r) => ({
        campaignId,
        phone: r.phone,
        name: r.name,
        variables: r.variables ? (r.variables as object) : undefined,
      })),
    }),
    prisma.campaign.update({
      where: { id: campaignId },
      data: { totalContacts: deduped.length },
    }),
  ]);
  return deduped.length;
}

export { getTemplateDisplayText };
