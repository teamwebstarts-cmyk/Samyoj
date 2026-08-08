import prisma from '../../config/database';
import { broadcastQueue } from '../../config/queues';
import { AppError } from '../../utils/response';
import { emitToOrg } from '../../realtime';
import { getOrgWhatsappContext, getWhatsappContextById } from '../whatsapp/context';
import { getTemplateDisplayText, MetaWhatsAppService } from '../whatsapp/meta.service';
import { resolveMetaCredentials } from '../whatsapp/org-meta.service';
import { logCampaignAudit } from './audit';
import { assertDailySendQuota, assertDailyBudget, getCampaignSettings, reserveCampaignQuota, releaseCampaignQuota } from './quota';
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
import { CAMPAIGN_CLAIM_LEASE_MS } from './safety';
import { getRedis } from '../../config/redis';

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
        optOutAt: null,
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
  contactWhere.optOutAt = null;

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
    select: { phone: true, name: true, consentSource: true, consentAt: true, optOutAt: true },
  });

  return dedupeRecipients(
    contacts.map((c) => ({
      phone: c.phone,
      name: c.name ?? undefined,
      variables: undefined,
    }))
  );
}

export async function syncRunningCampaignStatuses(organizationId?: string) {
  const running = await prisma.campaign.findMany({
    where: { ...(organizationId ? { organizationId } : {}), status: { in: ['RUNNING', 'PAUSED'] } },
    select: { id: true, updatedAt: true },
  });

  for (const campaign of running) {
    await recoverExpiredCampaignClaims(campaign.id);
    await recoverStuckCampaign(campaign.id, campaign.updatedAt);
    await finalizeCampaignIfDone(campaign.id);
  }
}

async function recoverStuckCampaign(campaignId: string, updatedAt: Date) {
  const age = Date.now() - updatedAt.getTime();
  if (age < STUCK_RUNNING_MS) return;

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
  if (!campaign || campaign.status !== 'RUNNING') return;
  const pending = await prisma.campaignRecipient.count({ where: { campaignId, status: 'PENDING' } });
  if (pending === 0) return;

  const recovered = await prisma.campaignRecipient.updateMany({
    where: { campaignId, status: 'PENDING' },
    data: {
      status: 'FAILED',
      errorMessage: 'Timed out — batch job did not complete',
    },
  });

  if (recovered.count > 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { failedCount: { increment: recovered.count } },
    });
  }
}

/** Expired claims are ambiguous: Meta may have accepted the request before a crash. */
export async function recoverExpiredCampaignClaims(campaignId: string, now = new Date()) {
  const cutoff = new Date(now.getTime() - CAMPAIGN_CLAIM_LEASE_MS);
  const recovered = await prisma.campaignRecipient.updateMany({
    where: {
      campaignId,
      status: 'PENDING',
      claimToken: { not: null },
      claimedAt: { lt: cutoff },
    },
    data: {
      status: 'AMBIGUOUS',
      errorMessage: 'Claim lease expired; reconcile with Meta before retrying',
      claimToken: null,
      claimedAt: null,
    },
  });
  return recovered.count;
}

export async function finalizeCampaignIfDone(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { recipients: true },
  });

  if (!campaign || !['RUNNING', 'PAUSED'].includes(campaign.status)) return;

  const pending = campaign.recipients.filter((r) => r.status === 'PENDING').length;
  const ambiguous = campaign.recipients.filter((r) => r.status === 'AMBIGUOUS').length;
  if (pending > 0 || ambiguous > 0) return;

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
  await releaseCampaignQuota(campaignId);
}

export async function syncCampaignRecipientFromWebhook(
  metaMessageId: string,
  status: string,
  context?: { organizationId: string; phoneNumberId?: string }
) {
  const normalized = status.toUpperCase();
  if (!['DELIVERED', 'READ', 'FAILED'].includes(normalized)) return;

  const recipient = await prisma.campaignRecipient.findUnique({
    where: { metaMessageId },
    include: { campaign: { include: { whatsappNumber: true } } },
  });
  if (
    !recipient ||
    (context &&
      (recipient.campaign.organizationId !== context.organizationId ||
        (context.phoneNumberId && recipient.campaign.whatsappNumber?.phoneNumberId !== context.phoneNumberId)))
  ) {
    // Never silently associate a status with another tenant/number. The webhook
    // has already been acknowledged, so recording a rejected event is safer
    // than making Meta retry the whole payload.
    if (context) {
      await logCampaignAudit(context.organizationId, undefined, 'campaign.webhook_status_rejected', {
        metaMessageId,
        status: normalized,
        phoneNumberId: context.phoneNumberId,
        reason: recipient ? 'context_mismatch' : 'unknown_meta_message',
      });
    }
    return;
  }

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
  userId?: string,
  claimedRunVersion?: number
) {
  if (campaign.status === 'RUNNING' && claimedRunVersion === undefined) throw new AppError(409, 'Campaign is already being sent');
  if (claimedRunVersion !== undefined) {
    const current = await prisma.campaign.findFirst({
      where: { id: campaign.id, status: 'RUNNING', runVersion: claimedRunVersion },
      select: { id: true },
    });
    if (!current) return { recipientCount: 0, stale: true };
  }
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
  await reserveCampaignQuota(campaign.organizationId, campaign.id, campaign.recipients.length, 'MARKETING');

  const claimedRun = claimedRunVersion === undefined
    ? await prisma.campaign.updateMany({
        where: { id: campaign.id, status: { in: ['DRAFT', 'SCHEDULED'] } },
        data: {
          status: 'RUNNING',
          runVersion: { increment: 1 },
          sentCount: 0,
          deliveredCount: 0,
          readCount: 0,
          failedCount: 0,
          pausedAt: null,
          cancelledAt: null,
          sentById: userId ?? null,
          templateLanguage,
        },
      })
    : { count: 1 };
  if (claimedRun.count !== 1) {
    await releaseCampaignQuota(campaign.id);
    throw new AppError(409, 'Campaign changed while it was being queued; try again');
  }
  const run = await prisma.campaign.findUnique({ where: { id: campaign.id }, select: { runVersion: true } });
  if (!run) throw new AppError(404, 'Campaign not found');

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { templateLanguage },
  });

  const reset = await prisma.campaignRecipient.updateMany({
    where: {
      campaignId: campaign.id,
      campaign: { status: 'RUNNING', runVersion: run.runVersion },
    },
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
  if (reset.count !== campaign.recipients.length) {
    await releaseCampaignQuota(campaign.id);
    throw new AppError(409, 'Campaign changed before recipients could be queued');
  }

  const settings = await getCampaignSettings(campaign.organizationId);
  const batchSize = settings.batchSize ?? 50;
  const batchDelayMs = settings.batchDelayMs ?? 1000;
  const totalBatches = Math.ceil(campaign.recipients.length / batchSize);

  try {
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
        runVersion: run.runVersion,
      },
      { delay: batchIndex * batchDelayMs, jobId: `campaign:${campaign.id}:batch:${batch[0].id}` }
    );
    }
  } catch (err) {
    await releaseCampaignQuota(campaign.id);
    await prisma.campaign.updateMany({
      where: { id: campaign.id, status: 'RUNNING', runVersion: run.runVersion },
      data: { status: 'FAILED' },
    });
    throw err;
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
    select: { optedIn: true, consentSource: true, consentAt: true, optOutAt: true },
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
    data: { status: 'PAUSED', pausedAt: new Date(), runVersion: { increment: 1 } },
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
    data: { status: 'RUNNING', pausedAt: null, runVersion: { increment: 1 } },
  });
  if (updated.count !== 1) throw new AppError(409, 'Campaign changed before it could be resumed');
  const resumedRun = await prisma.campaign.findUnique({ where: { id: campaign.id }, select: { runVersion: true } });
  if (!resumedRun) throw new AppError(404, 'Campaign not found');

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
        runVersion: resumedRun.runVersion,
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
        runVersion: { increment: 1 },
        cancelledAt: new Date(),
        pausedAt: null,
        failedCount: { increment: pending.count },
      },
    });
    return 1;
  });
  if (!result) throw new AppError(409, 'Campaign has already changed or reached a terminal state');

  await releaseCampaignQuota(campaignId);
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
  await reserveCampaignQuota(campaign.organizationId, campaign.id, failed.length, 'MARKETING');
  const retryRun = await prisma.campaign.updateMany({
    where: { id: campaign.id, status: { in: ['FAILED', 'COMPLETED', 'PAUSED'] } },
    data: {
      status: 'RUNNING',
      runVersion: { increment: 1 },
      failedCount: { decrement: failed.length },
      pausedAt: null,
    },
  });
  if (retryRun.count !== 1) {
    await releaseCampaignQuota(campaign.id);
    throw new AppError(409, 'Campaign changed before retry could start');
  }
  const retryVersion = await prisma.campaign.findUnique({ where: { id: campaign.id }, select: { runVersion: true } });
  if (!retryVersion) {
    await releaseCampaignQuota(campaign.id);
    throw new AppError(404, 'Campaign not found');
  }

  const reset = await prisma.campaignRecipient.updateMany({
    where: { id: { in: failed.map((r) => r.id) }, status: 'FAILED' },
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
  if (reset.count !== failed.length) {
    await releaseCampaignQuota(campaign.id);
    throw new AppError(409, 'Recipients changed before retry could start');
  }

  const totalBatches = Math.ceil(failed.length / batchSize);
  try {
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
        runVersion: retryVersion.runVersion,
      },
      { delay: batchIndex * batchDelayMs }
    );
    }
  } catch (err) {
    await releaseCampaignQuota(campaign.id);
    await prisma.campaign.updateMany({
      where: { id: campaign.id, status: 'RUNNING', runVersion: retryVersion.runVersion },
      data: { status: 'FAILED' },
    });
    throw err;
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
  const redis = getRedis();
  const lockToken = `${process.pid}:${Date.now()}`;
  const lockKey = 'campaign:scheduler:due-lock';
  if ((await redis.set(lockKey, lockToken, 'PX', 55_000, 'NX')) !== 'OK') return;
  try {
    // The same distributed lock also runs lease recovery, so a resumed
    // campaign cannot strand a claimed PENDING row on one API process.
    await syncRunningCampaignStatuses(organizationId);
    const due = await prisma.campaign.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      status: 'SCHEDULED',
      scheduledAt: { lte: new Date() },
    },
    select: { id: true },
    });

    for (const item of due) {
      const claimed = await prisma.campaign.updateMany({
        where: { id: item.id, ...(organizationId ? { organizationId } : {}), status: 'SCHEDULED' },
        data: { status: 'RUNNING', runVersion: { increment: 1 } },
      });
      if (claimed.count !== 1) continue;
      const campaign = await prisma.campaign.findUnique({ where: { id: item.id }, include: { recipients: true } });
      if (!campaign) continue;
      try {
        const queued = await queueCampaignSend(campaign, undefined, campaign.runVersion);
        if (queued.stale) continue;
        await logCampaignAudit(campaign.organizationId, undefined, 'campaign.scheduled_send', {
          campaignId: campaign.id,
        });
      } catch (err) {
        await prisma.campaign.updateMany({
          where: { id: campaign.id, status: 'RUNNING', runVersion: campaign.runVersion },
          data: { status: 'FAILED' },
        });
        await releaseCampaignQuota(campaign.id);
        await logCampaignAudit(campaign.organizationId, undefined, 'campaign.scheduled_send_failed', {
          campaignId: campaign.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    await redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      lockKey,
      lockToken
    );
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
