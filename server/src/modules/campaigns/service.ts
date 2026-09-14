import prisma from '../../config/database';
import { broadcastQueue } from '../../config/queues';
import { AppError } from '../../utils/response';
import { emitToOrg } from '../../realtime';
import { getOrgWhatsappContext, getWhatsappContextById } from '../whatsapp/context';
import { getTemplateDisplayText, MetaWhatsAppService } from '../whatsapp/meta.service';
import { resolveMetaCredentials } from '../whatsapp/org-meta.service';
import { logCampaignAudit } from './audit';
import {
  assertDailySendQuota,
  assertDailyBudget,
  getCampaignSettings,
  reserveCampaignQuota,
  releaseCampaignQuota,
  transferCampaignQuotaReservation,
} from './quota';
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
import { billingCategoryForTemplate, campaignRepeatWrite } from './types';
import { nextRepeatInstant, shouldScheduleRepeat } from './timezone';
import {
  dedupeRecipients,
  filterConsentedManualRecipients,
  hasAuditableCampaignConsent,
  type ResolvedRecipient,
} from './recipients';
import { AUDITABLE_CONSENT_WHERE } from '../contacts/consent';
import { Prisma } from '@prisma/client';
import type { Campaign, CampaignRecipient, CampaignStatus } from '@prisma/client';
import {
  CAMPAIGN_CLAIM_LEASE_MS,
  canFinalizeCampaignRun,
  campaignCounterSnapshot,
  reconcileWebhookRecipient,
  rollbackRecipientAction,
  shouldReleaseCampaignQuota,
  shouldReleaseQuotaAfterWebhook,
} from './safety';
import { getRedis } from '../../config/redis';
import { normalizePhoneIdentity } from '../../utils/phone';
import {
  buildCampaignJobId,
  canRollbackQueuedCampaign,
  manualCampaignRunClaimWhere,
  materializedCampaignRunVersion,
} from './worker-safety';
import { emitProductEvent } from '../platform/events';
import { assertApprovedCampaignTemplate, assertCampaignRecipientTemplates } from './template-validation';
import { whatsappSendFailurePatches } from '../whatsapp/send-failure-explain';
import { getCampaignCohortAudience, type CohortKind } from './cohorts';

const EDITABLE_STATUSES: CampaignStatus[] = ['DRAFT', 'SCHEDULED'];
const STUCK_RUNNING_MS = 6 * 60 * 60 * 1000;
const PAUSE_RECLAIM_MESSAGE = 'Campaign paused before provider send';

async function withLiveContactFields(
  organizationId: string,
  whatsappNumberId: string | null | undefined,
  recipients: Array<{
    name?: string | null;
    phone: string;
    variables?: { body?: string[]; header?: string[]; attributes?: Record<string, string> } | null;
  }>
) {
  if (!whatsappNumberId || recipients.length === 0) {
    return recipients.map((recipient) => ({
      name: recipient.name,
      phone: recipient.phone,
      email: undefined as string | undefined,
      customAttributes: undefined as unknown,
      variables: recipient.variables,
    }));
  }
  const phones = [...new Set(recipients.map((recipient) => normalizePhoneIdentity(recipient.phone)))];
  const contacts = await prisma.contact.findMany({
    where: {
      organizationId,
      whatsappNumberId,
      normalizedPhone: { in: phones },
    },
    select: { normalizedPhone: true, name: true, phone: true, email: true, customAttributes: true },
  });
  const byPhone = new Map(contacts.map((contact) => [contact.normalizedPhone, contact]));
  return recipients.map((recipient) => {
    const live = byPhone.get(normalizePhoneIdentity(recipient.phone));
    return {
      name: live?.name || recipient.name,
      phone: live?.phone || recipient.phone,
      email: live?.email,
      customAttributes: live?.customAttributes,
      variables: recipient.variables,
    };
  });
}

type CampaignRunSnapshot = {
  status: CampaignStatus;
  runVersion: number;
  templateLanguage: string | null;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  pausedAt: Date | null;
  cancelledAt: Date | null;
  sentById: string | null;
  recipients: CampaignRecipient[];
};

function snapshotCampaignRun(campaign: Campaign & { recipients: CampaignRecipient[] }): CampaignRunSnapshot {
  return {
    status: campaign.status,
    runVersion: campaign.runVersion,
    templateLanguage: campaign.templateLanguage,
    sentCount: campaign.sentCount,
    deliveredCount: campaign.deliveredCount,
    readCount: campaign.readCount,
    failedCount: campaign.failedCount,
    pausedAt: campaign.pausedAt,
    cancelledAt: campaign.cancelledAt,
    sentById: campaign.sentById,
    recipients: campaign.recipients.map((recipient) => ({ ...recipient })),
  };
}

async function restoreCampaignRun(
  campaignId: string,
  expectedRunVersion: number,
  snapshot: CampaignRunSnapshot
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${campaignId} FOR UPDATE`;
    const live = await tx.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true, runVersion: true },
    });
    if (!live || !canRollbackQueuedCampaign({ ...live, expectedRunVersion })) return false;

    const liveRecipients = await tx.campaignRecipient.findMany({ where: { campaignId } });
    const liveById = new Map(liveRecipients.map((recipient) => [recipient.id, recipient]));
    let ambiguousCount = 0;
    for (const recipient of snapshot.recipients) {
      const liveRecipient = liveById.get(recipient.id);
      if (!liveRecipient) continue;
      const action = rollbackRecipientAction(liveRecipient);
      if (action === 'RESTORE') {
        await tx.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: recipient.status,
            metaMessageId: recipient.metaMessageId,
            errorMessage: recipient.errorMessage,
            retryCount: recipient.retryCount,
            claimToken: recipient.claimToken,
            claimedAt: recipient.claimedAt,
            providerCallStartedAt: recipient.providerCallStartedAt,
            consentSnapshot: recipient.consentSnapshot === null ? Prisma.JsonNull : recipient.consentSnapshot,
            sentAt: recipient.sentAt,
            deliveredAt: recipient.deliveredAt,
            readAt: recipient.readAt,
          },
        });
      } else if (action === 'AMBIGUOUS') {
        ambiguousCount += 1;
        // No fake Meta reconciliation is attempted here. Keep the row explicitly
        // non-retryable until an operator reconciles the provider outcome.
        await tx.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'AMBIGUOUS',
            errorMessage: 'Provider boundary crossed during queue rollback; reconcile with Meta before retrying',
            claimToken: null,
            claimedAt: null,
          },
        });
      }
    }
    const finalRecipients = await tx.campaignRecipient.findMany({
      where: { campaignId },
      select: { status: true },
    });
    const counters = campaignCounterSnapshot(finalRecipients.map((recipient) => recipient.status));
    await tx.campaign.update({
      where: { id: campaignId },
      data: {
        status: ambiguousCount ? 'FAILED' : snapshot.status,
        runVersion: ambiguousCount ? expectedRunVersion : snapshot.runVersion,
        templateLanguage: snapshot.templateLanguage,
        ...counters,
        pausedAt: ambiguousCount ? null : snapshot.pausedAt,
        cancelledAt: ambiguousCount ? null : snapshot.cancelledAt,
        sentById: snapshot.sentById,
      },
    });
    return { restored: true, ambiguousCount };
  });
}

async function removeQueuedCampaignJobs(jobIds: string[]) {
  await Promise.all(jobIds.map(async (jobId) => {
    const job = await broadcastQueue.getJob(jobId);
    if (job) await job.remove().catch(() => undefined);
  }));
}

export async function reconcileCampaignCounters(campaignId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${campaignId} FOR UPDATE`;
    const recipients = await tx.campaignRecipient.findMany({
      where: { campaignId },
      select: { status: true },
    });
    const counters = campaignCounterSnapshot(recipients.map((recipient) => recipient.status));
    await tx.campaign.update({ where: { id: campaignId }, data: counters });
    return counters;
  });
}

async function transitionRecipientsForStop(
  tx: Prisma.TransactionClient,
  campaignId: string,
  reason: 'paused' | 'cancelled'
) {
  const safe = await tx.campaignRecipient.updateMany({
    where: { campaignId, status: 'PENDING', claimToken: null, providerCallStartedAt: null },
    data: { status: 'FAILED', errorMessage: reason === 'paused' ? PAUSE_RECLAIM_MESSAGE : 'Campaign cancelled' },
  });
  const safeClaims = await tx.campaignRecipient.updateMany({
    where: { campaignId, status: 'PENDING', claimToken: { not: null }, providerCallStartedAt: null },
    data: {
      status: 'FAILED',
      errorMessage: reason === 'paused' ? PAUSE_RECLAIM_MESSAGE : 'Campaign cancelled before provider send',
      claimToken: null,
      claimedAt: null,
    },
  });
  const ambiguous = await tx.campaignRecipient.updateMany({
    where: {
      campaignId,
      status: 'PENDING',
      OR: [{ claimToken: { not: null } }, { providerCallStartedAt: { not: null } }],
    },
    data: {
      status: 'AMBIGUOUS',
      errorMessage: `Provider boundary crossed before campaign ${reason}; reconcile with Meta`,
      claimToken: null,
      claimedAt: null,
    },
  });
  const unresolved = await tx.campaignRecipient.count({
    where: {
      campaignId,
      OR: [
        { status: 'AMBIGUOUS' },
        { claimToken: { not: null } },
        { providerCallStartedAt: { not: null } },
      ],
    },
  });
  return { failed: safe.count + safeClaims.count, ambiguous: Math.max(ambiguous.count, unresolved) };
}

export type { ResolvedRecipient };
export { dedupeRecipients };

type AudienceGroup = NonNullable<AudienceConfig['groups']>[number];

function buildAudienceGroupScopes(groups: AudienceGroup[]) {
  if (!groups.length) throw new AppError(400, 'At least one audience group is required');

  return groups.map((group) => {
    if (group.type === 'TAGS') {
      const tags = group.tags?.filter(Boolean) || [];
      if (!tags.length) throw new AppError(400, 'At least one tag is required for tag-based audience');
      return { tags: { hasSome: tags } } satisfies Prisma.ContactWhereInput;
    }

    const contactIds = group.contactIds?.filter(Boolean) || [];
    if (!contactIds.length) throw new AppError(400, 'At least one contact is required');
    return { id: { in: contactIds } } satisfies Prisma.ContactWhereInput;
  });
}

function buildAudienceScope(
  organizationId: string,
  groups: AudienceGroup[],
  operator: 'OR' | 'AND',
  whatsappNumberId: string,
): Prisma.ContactWhereInput {
  const scopes = buildAudienceGroupScopes(groups);
  return {
    organizationId,
    whatsappNumberId,
    [operator === 'AND' ? 'AND' : 'OR']: scopes,
  };
}

function addConsentFilter(scope: Prisma.ContactWhereInput): Prisma.ContactWhereInput {
  return {
    ...scope,
    ...AUDITABLE_CONSENT_WHERE,
  };
}

export async function resolveAudienceRecipients(
  organizationId: string,
  audienceType: AudienceType,
  audienceConfig: AudienceConfig | null | undefined,
  manualRecipients: ResolvedRecipient[] = [],
  whatsappNumberId: string
): Promise<ResolvedRecipient[]> {
  const audienceConfigDrip = audienceConfig?.drip;
  if (audienceConfigDrip?.isStep2 && audienceConfigDrip?.parentCampaignId) {
    const kind: CohortKind = audienceConfigDrip.condition === 'unread' ? 'delivered_unread' : 'no_reply';
    const cohortAudience = await getCampaignCohortAudience(
      audienceConfigDrip.parentCampaignId,
      organizationId,
      kind,
      whatsappNumberId
    );
    if (!cohortAudience || !cohortAudience.contactIds.length) {
      return [];
    }
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: cohortAudience.contactIds },
        organizationId,
        whatsappNumberId,
        optedIn: true,
        consentSource: { not: null },
        consentAt: { not: null },
        optOutAt: null,
      },
      select: { phone: true, name: true },
    });
    return dedupeRecipients(
      contacts.map((c) => ({
        phone: c.phone,
        name: c.name ?? undefined,
        variables: undefined,
      }))
    );
  }

  const groups = audienceConfig?.groups;
  if (groups?.length) {
    const contactWhere = addConsentFilter(
      buildAudienceScope(organizationId, groups, audienceConfig?.operator || 'OR', whatsappNumberId),
    );
    const contacts = await prisma.contact.findMany({
      where: contactWhere,
      select: { phone: true, name: true },
    });
    return dedupeRecipients(
      contacts.map((contact) => ({
        phone: contact.phone,
        name: contact.name ?? undefined,
        variables: undefined,
      })),
    );
  }

  if (audienceType === 'MANUAL') {
    const deduped = dedupeRecipients(manualRecipients);
    if (!deduped.length) return deduped;
    const phones = deduped.map((recipient) => recipient.phone);
    const identities = [...new Set(phones.map((phone) => normalizePhoneIdentity(phone)).filter(Boolean))];
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId,
        whatsappNumberId,
        OR: [{ phone: { in: phones } }, { normalizedPhone: { in: identities } }],
      },
      select: {
        phone: true,
        normalizedPhone: true,
        optedIn: true,
        consentSource: true,
        consentAt: true,
        optOutAt: true,
      },
    });
    return filterConsentedManualRecipients(deduped, contacts);
  }

  const contactWhere: Prisma.ContactWhereInput = { organizationId, whatsappNumberId };
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

/**
 * Return the numbers needed by the campaign wizard without exposing recipient
 * data. `count` is the fail-closed, consent-eligible audience that will
 * actually be queued. The failure/reach values are intentionally estimates:
 * provider delivery failures are only known after a send.
 */
export async function previewAudienceMetrics(
  organizationId: string,
  audienceType: AudienceType,
  audienceConfig: AudienceConfig | null | undefined,
  manualRecipients: ResolvedRecipient[] = [],
  whatsappNumberId: string
) {
  const groups = audienceConfig?.groups;
  if (groups?.length) {
    const scope = buildAudienceScope(organizationId, groups, audienceConfig?.operator || 'OR', whatsappNumberId);
    const [total, optedIn] = await Promise.all([
      prisma.contact.count({ where: scope }),
      prisma.contact.count({ where: addConsentFilter(scope) }),
    ]);
    const estimatedFailed = Math.max(0, Math.round(optedIn * 0.01));
    return {
      count: optedIn,
      total,
      optedIn,
      notOptedIn: Math.max(0, total - optedIn),
      estimatedFailed,
      estimatedReach: Math.max(0, optedIn - estimatedFailed),
    };
  }

  let total = 0;
  let optedIn = 0;

  if (audienceType === 'MANUAL') {
    const recipients = dedupeRecipients(manualRecipients);
    total = recipients.length;
    if (recipients.length) {
      const phones = recipients.map((recipient) => recipient.phone);
      const identities = [...new Set(phones.map((phone) => normalizePhoneIdentity(phone)).filter(Boolean))];
      const contacts = await prisma.contact.findMany({
        where: {
          organizationId,
          whatsappNumberId,
          OR: [{ phone: { in: phones } }, { normalizedPhone: { in: identities } }],
        },
        select: {
          phone: true,
          normalizedPhone: true,
          optedIn: true,
          consentSource: true,
          consentAt: true,
          optOutAt: true,
        },
      });
      optedIn = filterConsentedManualRecipients(recipients, contacts).length;
    }
  } else {
    const scope: Prisma.ContactWhereInput = { organizationId, whatsappNumberId };
    if (audienceType === 'TAGS') {
      const tags = audienceConfig?.tags?.filter(Boolean) || [];
      if (!tags.length) throw new AppError(400, 'At least one tag is required for tag-based audience');
      scope.tags = { hasSome: tags };
    } else if (audienceType === 'CONTACTS') {
      const contactIds = audienceConfig?.contactIds?.filter(Boolean) || [];
      if (!contactIds.length) throw new AppError(400, 'At least one contact is required');
      scope.id = { in: contactIds };
    }

    const eligibleWhere: Prisma.ContactWhereInput = {
      ...scope,
      optedIn: true,
      consentSource: { not: null },
      consentAt: { not: null },
      optOutAt: null,
    };
    [total, optedIn] = await Promise.all([
      prisma.contact.count({ where: scope }),
      prisma.contact.count({ where: eligibleWhere }),
    ]);
  }

  const estimatedFailed = Math.max(0, Math.round(optedIn * 0.01));
  return {
    count: optedIn,
    total,
    optedIn,
    notOptedIn: Math.max(0, total - optedIn),
    estimatedFailed,
    estimatedReach: Math.max(0, optedIn - estimatedFailed),
  };
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

  await recoverCompletedRepeats(organizationId);
}

export async function recoverCompletedRepeats(organizationId?: string) {
  const stuck = await prisma.campaign.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      status: 'COMPLETED',
      cancelledAt: null,
      repeatIntervalDays: { gte: 1 },
    },
    select: { id: true },
    take: 50,
  });
  for (const campaign of stuck) {
    await scheduleNextRepeatIfNeeded(campaign.id);
  }
}

async function recoverStuckCampaign(campaignId: string, updatedAt: Date) {
  const age = Date.now() - updatedAt.getTime();
  if (age < STUCK_RUNNING_MS) return;

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
  if (!campaign || campaign.status !== 'RUNNING') return;
  const pending = await prisma.campaignRecipient.count({ where: { campaignId, status: 'PENDING' } });
  if (pending === 0) return;

  const providerBound = await prisma.campaignRecipient.updateMany({
    where: {
      campaignId,
      status: 'PENDING',
      OR: [{ claimToken: { not: null } }, { providerCallStartedAt: { not: null } }],
    },
    data: {
      status: 'AMBIGUOUS',
      errorMessage: 'Timed out after provider boundary; reconcile with Meta before retrying',
      claimToken: null,
      claimedAt: null,
    },
  });
  const recovered = await prisma.campaignRecipient.updateMany({
    where: {
      campaignId,
      status: 'PENDING',
      claimToken: null,
      providerCallStartedAt: null,
    },
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
  return recovered.count + providerBound.count;
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
      providerCallStartedAt: null,
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

export async function finalizeCampaignIfDone(campaignId: string, expectedRunVersion?: number) {
  const finalized = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${campaignId} FOR UPDATE`;
    const campaign = await tx.campaign.findUnique({
      where: { id: campaignId },
      include: { recipients: true },
    });

    if (!campaign) {
      return null;
    }

    const pending = campaign.recipients.filter((r) => r.status === 'PENDING').length;
    const ambiguous = campaign.recipients.filter((r) => r.status === 'AMBIGUOUS').length;
    const runVersion = expectedRunVersion ?? campaign.runVersion;
    if (!canFinalizeCampaignRun(campaign.status, campaign.runVersion, runVersion, pending, ambiguous)) {
      return null;
    }

    const allFailed = campaign.failedCount >= campaign.totalContacts;
    const status: CampaignStatus = allFailed ? 'FAILED' : 'COMPLETED';
    const updated = await tx.campaign.updateMany({
      where: { id: campaignId, status: campaign.status, runVersion: campaign.runVersion },
      data: { status, pausedAt: null },
    });
    if (updated.count !== 1) return null;
    return { campaign, status, runVersion };
  });

  if (!finalized) return;
  const { campaign, status, runVersion } = finalized;

  emitToOrg(campaign.organizationId, 'campaign:status', { campaignId, status });
  emitProductEvent({
    organizationId: campaign.organizationId,
    name: status === 'COMPLETED' ? 'CAMPAIGN_SENT' : 'CAMPAIGN_FAILED',
  });

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
    await prisma.campaign.updateMany({
      where: { id: campaignId, status: 'COMPLETED' },
      data: { repeatOccurrenceCount: { increment: 1 } },
    });
    await scheduleNextRepeatIfNeeded(campaignId);
    await scheduleDripFollowUpIfNeeded(campaignId);
  }
  await releaseCampaignQuota(campaignId, runVersion);
}

export async function syncCampaignRecipientFromWebhook(
  metaMessageId: string,
  status: string,
  context?: {
    organizationId: string;
    phoneNumberId?: string;
    timestamp?: Date;
    errors?: unknown;
  }
) {
  const normalized = status.toUpperCase();
  if (!['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(normalized)) return;

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
  // A missing or malformed provider timestamp is not an event time. Do not
  // invent one: accepting it would mutate reconciliation state nondeterministically.
  if (!context?.timestamp || Number.isNaN(context.timestamp.getTime())) return;

  await prisma.$transaction(async (tx) => {
    const current = await tx.campaignRecipient.findUnique({ where: { id: recipient.id } });
    if (!current) return;
    const eventAt = context.timestamp!;
    const data: Prisma.CampaignRecipientUpdateInput = {};
    const reconciliation = reconcileWebhookRecipient({
      currentStatus: current.status,
      providerStatus: normalized,
      claimToken: current.claimToken,
      providerCallStartedAt: current.providerCallStartedAt,
      currentProviderStatusAt: current.providerStatusAt,
      providerStatusAt: eventAt,
    });
    if (reconciliation) {
      data.status = reconciliation.status;
      data.providerStatusAt = eventAt;
      data.providerEventKey = `${metaMessageId}:${normalized}:${eventAt.toISOString()}`;
      if (normalized === 'SENT') data.sentAt = current.sentAt ?? eventAt;
      if (normalized === 'DELIVERED' || normalized === 'READ') {
        data.sentAt = current.sentAt ?? eventAt;
        data.deliveredAt = current.deliveredAt ?? eventAt;
      }
      if (normalized === 'READ') data.readAt = current.readAt ?? eventAt;
      if (normalized === 'FAILED') {
        const failure = whatsappSendFailurePatches({ errors: context?.errors });
        data.errorMessage = reconciliation.status === 'AMBIGUOUS'
          ? 'Delivery outcome raced an active provider call; reconcile with Meta before retrying'
          : failure.explained.body;
      }
      if (context?.errors) {
        data.consentSnapshot = {
          ...((current.consentSnapshot as Record<string, unknown> | null) ?? {}),
          webhookErrors: context.errors,
          webhookStatus: normalized,
          webhookTimestamp: eventAt.toISOString(),
        } as Prisma.InputJsonValue;
      }
      if (reconciliation.clearClaim) {
        data.claimToken = null;
        data.claimedAt = null;
        data.providerCallStartedAt = null;
      }
    }
    if (!Object.keys(data).length) return;
    const changed = await tx.campaignRecipient.updateMany({
      where: {
        id: recipient.id,
        status: current.status,
        claimToken: current.claimToken,
        providerCallStartedAt: current.providerCallStartedAt,
        campaign: { id: recipient.campaignId, runVersion: recipient.campaign.runVersion },
      },
      data,
    });
    if (changed.count !== 1) return;
  });

  await reconcileCampaignCounters(recipient.campaignId);
  await finalizeCampaignIfDone(recipient.campaignId, recipient.campaign.runVersion);
  const live = await prisma.campaign.findFirst({
    where: {
      id: recipient.campaignId,
      organizationId: recipient.campaign.organizationId,
      whatsappNumberId: recipient.campaign.whatsappNumberId,
    },
    select: {
      runVersion: true,
      status: true,
      recipients: { select: { status: true, claimToken: true, providerCallStartedAt: true } },
    },
  });
  if (
    live &&
    live.runVersion === recipient.campaign.runVersion &&
    live.recipients.every((row) => row.status !== 'PENDING' && row.status !== 'AMBIGUOUS') &&
    shouldReleaseQuotaAfterWebhook(live.recipients)
  ) {
    // The webhook may arrive after a newer run has started. Release only the
    // reservation owned by the run that produced this Meta message ID.
    await releaseCampaignQuota(recipient.campaignId, recipient.campaign.runVersion);
  }
  emitToOrg(recipient.campaign.organizationId, 'campaign:progress', {
    campaignId: recipient.campaignId,
    recipientId: recipient.id,
    status: normalized,
  });
}

async function getWhatsappForCampaign(orgId: string, whatsappNumberId?: string | null) {
  if (!whatsappNumberId) {
    throw new AppError(409, 'Campaign has unresolved WhatsApp number ownership');
  }
  return getWhatsappContextById(orgId, whatsappNumberId);
}

async function validateTemplate(
  orgId: string,
  templateName: string,
  wabaId: string,
  accessToken: string
): Promise<NonNullable<Awaited<ReturnType<typeof MetaWhatsAppService.getMessageTemplate>>>> {
  const template = await MetaWhatsAppService.getMessageTemplate(wabaId, accessToken, templateName);
  if (!template) {
    throw new AppError(400, `Template "${templateName}" was not found on the connected WhatsApp account`);
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
  if (!campaign.whatsappNumberId) {
    throw new AppError(409, 'Campaign has unresolved WhatsApp number ownership');
  }

  if (campaign.audienceType !== 'MANUAL') {
    const resolved = await resolveAudienceRecipients(
      campaign.organizationId,
      campaign.audienceType as AudienceType,
      campaign.audienceConfig as AudienceConfig | null,
      [],
      campaign.whatsappNumberId
    );
    if (!resolved.length) {
      const audienceConfig = campaign.audienceConfig as AudienceConfig | null;
      if (audienceConfig?.drip?.isStep2) {
        await prisma.campaign.updateMany({
          where: { id: campaign.id, status: 'RUNNING', runVersion: claimedRunVersion ?? campaign.runVersion },
          data: { status: 'COMPLETED' },
        });
        emitToOrg(campaign.organizationId, 'campaign:status', { campaignId: campaign.id, status: 'COMPLETED' });
        await logCampaignAudit(campaign.organizationId, undefined, 'campaign.drip_completed_empty_cohort', {
          campaignId: campaign.id,
        });
        return { recipientCount: 0, stale: false };
      }
      throw new AppError(400, 'No recipients match the selected audience');
    }
    const materializedRunVersion = materializedCampaignRunVersion(
      campaign.runVersion,
      claimedRunVersion === undefined
    );
    await persistRecipients(
      campaign.id,
      resolved,
      campaign.runVersion,
      { bumpRunVersion: claimedRunVersion === undefined }
    );
    const refreshed = await prisma.campaign.findFirst({
      where: { id: campaign.id, runVersion: materializedRunVersion },
      include: { recipients: true },
    });
    if (!refreshed) {
      throw new AppError(409, 'Campaign changed while recipients were being materialized; try again');
    }
    campaign = refreshed;
  }

  const latestGeneration = campaign.recipients.reduce(
    (max, row) => Math.max(max, row.runGeneration ?? 0),
    0
  );
  const sendRecipients = campaign.recipients.filter(
    (row) => row.status === 'PENDING' && (row.runGeneration ?? 0) === latestGeneration
  );
  if (!sendRecipients.length) {
    throw new AppError(400, 'Campaign has no recipients');
  }

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
  const billingCategory = billingCategoryForTemplate(template.category);

  await assertDailySendQuota(campaign.organizationId, sendRecipients.length, whatsappNumber.id);
  await assertDailyBudget(campaign.organizationId, sendRecipients.length, billingCategory);
  const templateLanguage = campaign.templateLanguage || template.language || 'en_US';
  const templateParams = (campaign.templateParams as TemplateParams | null) || undefined;
  try {
    assertCampaignRecipientTemplates(
      template,
      templateParams,
      await withLiveContactFields(
        campaign.organizationId,
        whatsappNumber.id,
        sendRecipients.map((recipient) => ({
          name: recipient.name,
          phone: recipient.phone,
          variables: recipient.variables as { body?: string[]; header?: string[]; attributes?: Record<string, string> } | null,
        }))
      ),
      { name: campaign.templateName, language: templateLanguage }
    );
  } catch (error) {
    throw new AppError(400, error instanceof Error ? error.message : String(error));
  }
  const templateContent = applyTemplateParamsToPreview(template, templateParams, campaign.templateName);
  const runSnapshot = snapshotCampaignRun(campaign);
  const claimedRun = claimedRunVersion === undefined
    ? await prisma.campaign.updateMany({
        where: manualCampaignRunClaimWhere(campaign.id, campaign.runVersion),
        data: {
          status: 'RUNNING',
          runVersion: { increment: 1 },
          sentCount: 0,
          deliveredCount: 0,
          readCount: 0,
          failedCount: 0,
          totalContacts: sendRecipients.length,
          pausedAt: null,
          cancelledAt: null,
          sentById: userId ?? null,
          templateLanguage,
        },
      })
    : { count: 1 };
  if (claimedRun.count !== 1) {
    throw new AppError(409, 'Campaign changed while it was being queued; try again');
  }
  const run = await prisma.campaign.findUnique({ where: { id: campaign.id }, select: { runVersion: true } });
  if (!run) throw new AppError(404, 'Campaign not found');
  if (claimedRunVersion !== undefined) {
    await prisma.campaign.updateMany({
      where: { id: campaign.id, status: 'RUNNING', runVersion: run.runVersion },
      data: { totalContacts: sendRecipients.length },
    });
  }
  const settings = await getCampaignSettings(campaign.organizationId);
  const batchSize = settings.batchSize ?? 50;
  const batchDelayMs = settings.batchDelayMs ?? 1000;
  const totalBatches = Math.ceil(sendRecipients.length / batchSize);

  const queuedJobIds: string[] = [];
  try {
    await reserveCampaignQuota(
      campaign.organizationId,
      campaign.id,
      run.runVersion,
      sendRecipients.length,
      billingCategory,
      whatsappNumber.id,
    );
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { templateLanguage },
    });
    const reset = await prisma.campaignRecipient.updateMany({
      where: {
        campaignId: campaign.id,
        status: 'PENDING',
        campaign: { status: 'RUNNING', runVersion: run.runVersion },
      },
      data: {
        status: 'PENDING',
        metaMessageId: null,
        claimToken: null,
        claimedAt: null,
        providerCallStartedAt: null,
        errorMessage: null,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
      },
    });
    if (reset.count !== sendRecipients.length) {
      throw new AppError(409, 'Campaign changed before recipients could be queued');
    }
    for (let i = 0; i < sendRecipients.length; i += batchSize) {
    const batch = sendRecipients.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);
    const jobId = buildCampaignJobId(campaign.id, run.runVersion, 'batch', batch[0].id);
    await broadcastQueue.add(
      'send-broadcast-batch',
      {
        campaignId: campaign.id,
        organizationId: campaign.organizationId,
        whatsappNumberDbId: whatsappNumber.id,
        phoneNumberId: whatsappNumber.phoneNumberId,
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
      { delay: batchIndex * batchDelayMs, jobId }
    );
    queuedJobIds.push(jobId);
    }
  } catch (err) {
    await removeQueuedCampaignJobs(queuedJobIds);
    const rollback = await restoreCampaignRun(campaign.id, run.runVersion, runSnapshot);
    if (rollback && shouldReleaseCampaignQuota(rollback.ambiguousCount)) {
      await releaseCampaignQuota(campaign.id, run.runVersion);
    }
    throw err;
  }

  emitToOrg(campaign.organizationId, 'campaign:status', {
    campaignId: campaign.id,
    status: 'RUNNING',
  });

  return { recipientCount: sendRecipients.length };
}

export async function sendTestMessage(
  campaign: Campaign,
  phone: string,
  userId?: string
) {
  const { whatsappNumber, wabaId, accessToken } = await getWhatsappForCampaign(
    campaign.organizationId,
    campaign.whatsappNumberId
  );
  const contact = await prisma.contact.findUnique({
    where: {
      organizationId_whatsappNumberId_normalizedPhone: {
        organizationId: campaign.organizationId,
        whatsappNumberId: whatsappNumber.id,
        normalizedPhone: phone,
      },
    },
    select: { name: true, phone: true, email: true, optedIn: true, consentSource: true, consentAt: true, optOutAt: true },
  });
  if (!contact || !hasAuditableCampaignConsent(contact)) {
    throw new AppError(400, 'Test sends require an existing opted-in contact with recorded consent');
  }
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
    contact.name,
    template,
    { name: contact.name, phone: contact.phone, email: contact.email }
  );
  const components = buildTemplateComponents(templateParams, template);
  try {
    assertApprovedCampaignTemplate(template, {
      name: campaign.templateName,
      language: templateLanguage,
      params: templateParams,
    });
  } catch (error) {
    throw new AppError(400, error instanceof Error ? error.message : String(error));
  }

  const result = await MetaWhatsAppService.sendMessage(
    whatsappNumber.phoneNumberId,
    accessToken,
    {
      to: phone,
      type: 'template',
      template: {
        name: campaign.templateName,
        language: { code: templateLanguage },
        ...(components.length ? { components } : {}),
      },
    },
    {
      whatsappNumberId: whatsappNumber.id,
      isOnBizApp: Boolean(whatsappNumber.isOnBizApp),
    }
  );

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
  if (!campaign.whatsappNumberId) throw new AppError(409, 'Campaign has unresolved WhatsApp number ownership');
  if (campaign.status !== 'RUNNING') throw new AppError(400, 'Only running campaigns can be paused');

  await prisma.$transaction(async (tx) => {
    const updated = await tx.campaign.updateMany({
      where: { id: campaignId, organizationId: orgId, status: 'RUNNING', runVersion: campaign.runVersion },
      data: { status: 'PAUSED', pausedAt: new Date(), runVersion: { increment: 1 } },
    });
    if (updated.count !== 1) throw new AppError(409, 'Campaign changed before it could be paused');
    await transferCampaignQuotaReservation(tx, campaignId, campaign.runVersion, campaign.runVersion + 1);
    const stopped = await transitionRecipientsForStop(tx, campaignId, 'paused');
    await tx.campaign.update({
      where: { id: campaignId },
      data: { failedCount: { increment: stopped.failed } },
    });
  });
  await reconcileCampaignCounters(campaignId);

  await logCampaignAudit(orgId, userId, 'campaign.pause', { campaignId });
  emitToOrg(orgId, 'campaign:status', { campaignId, status: 'PAUSED' });
}

export async function resumeCampaign(
  campaign: Campaign & { recipients: CampaignRecipient[] },
  userId?: string
) {
  if (!campaign.whatsappNumberId) {
    throw new AppError(409, 'Campaign has unresolved WhatsApp number ownership');
  }
  if (campaign.status !== 'PAUSED') throw new AppError(400, 'Only paused campaigns can be resumed');

  const transition = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${campaign.id} FOR UPDATE`;
    const current = await tx.campaign.findFirst({
      where: { id: campaign.id, status: 'PAUSED', runVersion: campaign.runVersion },
      select: { id: true, runVersion: true },
    });
    if (!current) throw new AppError(409, 'Campaign changed before it could be resumed');
    const reclaimed = await tx.campaignRecipient.updateMany({
      where: {
        campaignId: campaign.id,
        status: 'FAILED',
        errorMessage: PAUSE_RECLAIM_MESSAGE,
        claimToken: null,
        providerCallStartedAt: null,
      },
      data: {
        status: 'PENDING',
        errorMessage: null,
        providerCallStartedAt: null,
        retryCount: { increment: 1 },
      },
    });
    if (reclaimed.count) {
      await tx.campaign.update({
        where: { id: campaign.id },
        data: { failedCount: { decrement: reclaimed.count } },
      });
    }
    const updated = await tx.campaign.updateMany({
      where: { id: campaign.id, status: 'PAUSED', runVersion: campaign.runVersion },
      data: { status: 'RUNNING', pausedAt: null, runVersion: { increment: 1 } },
    });
    if (updated.count !== 1) throw new AppError(409, 'Campaign changed before it could be resumed');
    await transferCampaignQuotaReservation(
      tx,
      campaign.id,
      current.runVersion,
      current.runVersion + 1
    );
    return {
      pausedRunVersion: current.runVersion,
      resumedRunVersion: current.runVersion + 1,
      reclaimedCount: reclaimed.count,
    };
  });
  const rollbackResume = async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${campaign.id} FOR UPDATE`;
      const live = await tx.campaign.findUnique({
        where: { id: campaign.id },
        select: { status: true, runVersion: true },
      });
      if (
        !live ||
        live.status !== 'RUNNING' ||
        live.runVersion !== transition.resumedRunVersion
      ) return;
      const stopped = await transitionRecipientsForStop(tx, campaign.id, 'paused');
      await tx.campaign.update({
        where: { id: campaign.id },
        data: {
          status: 'PAUSED',
          pausedAt: new Date(),
          runVersion: transition.pausedRunVersion,
          failedCount: { increment: stopped.failed },
        },
      });
      await transferCampaignQuotaReservation(
        tx,
        campaign.id,
        transition.resumedRunVersion,
        transition.pausedRunVersion
      );
    });
  };

  const queuedJobIds: string[] = [];
  try {
    const current = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: { recipients: true },
    });
    if (!current) throw new AppError(404, 'Campaign not found');
    campaign = current;
    const latestGeneration = campaign.recipients.reduce(
      (max, row) => Math.max(max, row.runGeneration ?? 0),
      0
    );
    const pending = campaign.recipients.filter(
      (r) => r.status === 'PENDING' && (r.runGeneration ?? 0) === latestGeneration
    );
    if (!pending.length) {
      await finalizeCampaignIfDone(campaign.id);
      throw new AppError(400, 'No pending recipients to resume');
    }

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
    assertCampaignRecipientTemplates(
      template,
      templateParams,
      await withLiveContactFields(
        campaign.organizationId,
        whatsappNumber.id,
        pending.map((recipient) => ({
          name: recipient.name,
          phone: recipient.phone,
          variables: recipient.variables as { body?: string[]; header?: string[]; attributes?: Record<string, string> } | null,
        }))
      ),
      { name: campaign.templateName, language: templateLanguage }
    );
    const templateContent = applyTemplateParamsToPreview(template, templateParams, campaign.templateName);

    const totalBatches = Math.ceil(pending.length / batchSize);
    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);
      const jobId = buildCampaignJobId(
        campaign.id,
        transition.resumedRunVersion,
        'retry',
        batch[0].id
      );
      await broadcastQueue.add(
        'send-broadcast-batch',
        {
          campaignId: campaign.id,
          organizationId: campaign.organizationId,
          whatsappNumberDbId: whatsappNumber.id,
          phoneNumberId: whatsappNumber.phoneNumberId,
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
          runVersion: transition.resumedRunVersion,
        },
        { delay: batchIndex * batchDelayMs, jobId }
      );
      queuedJobIds.push(jobId);
    }

    await logCampaignAudit(campaign.organizationId, userId, 'campaign.resume', { campaignId: campaign.id });
    emitToOrg(campaign.organizationId, 'campaign:status', { campaignId: campaign.id, status: 'RUNNING' });
  } catch (err) {
    await removeQueuedCampaignJobs(queuedJobIds);
    await rollbackResume();
    throw err;
  }
}

export async function cancelCampaign(campaignId: string, orgId: string, userId?: string) {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, organizationId: orgId } });
  if (!campaign) throw new AppError(404, 'Campaign not found');
  if (!campaign.whatsappNumberId) throw new AppError(409, 'Campaign has unresolved WhatsApp number ownership');
  if (!['RUNNING', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) {
    throw new AppError(400, 'Campaign cannot be cancelled in its current state');
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${campaignId} FOR UPDATE`;
    const current = await tx.campaign.findFirst({
      where: { id: campaignId, organizationId: orgId, status: { in: ['RUNNING', 'PAUSED', 'SCHEDULED'] } },
      select: { id: true },
    });
    if (!current) return null;
    const stopped = await transitionRecipientsForStop(tx, campaignId, 'cancelled');
    await tx.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'CANCELLED',
        runVersion: { increment: 1 },
        cancelledAt: new Date(),
        pausedAt: null,
        failedCount: { increment: stopped.failed },
      },
    });
    return { ambiguous: stopped.ambiguous };
  });
  if (!result) throw new AppError(409, 'Campaign has already changed or reached a terminal state');

  // Keep quota reserved while AMBIGUOUS rows may represent accepted provider
  // sends; releasing would allow unsafe duplicate use before Meta reconciliation.
  if (shouldReleaseCampaignQuota(result.ambiguous)) await releaseCampaignQuota(campaignId, campaign.runVersion);
  await reconcileCampaignCounters(campaignId);
  await logCampaignAudit(orgId, userId, 'campaign.cancel', { campaignId });
  emitToOrg(orgId, 'campaign:status', { campaignId, status: 'CANCELLED' });
}

export async function retryFailedRecipients(
  campaign: Campaign & { recipients: CampaignRecipient[] },
  userId?: string
) {
  if (!campaign.whatsappNumberId) {
    throw new AppError(409, 'Campaign has unresolved WhatsApp number ownership');
  }
  const latestGeneration = campaign.recipients.reduce(
    (max, row) => Math.max(max, row.runGeneration ?? 0),
    0
  );
  const failed = campaign.recipients.filter(
    (r) => r.status === 'FAILED' && (r.runGeneration ?? 0) === latestGeneration
  );
  if (!failed.length) throw new AppError(400, 'No failed recipients to retry');

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
  const billingCategory = billingCategoryForTemplate(template.category);
  await assertDailySendQuota(campaign.organizationId, failed.length, whatsappNumber.id);
  await assertDailyBudget(campaign.organizationId, failed.length, billingCategory);
  const templateLanguage = campaign.templateLanguage || template.language || 'en_US';
  const templateParams = (campaign.templateParams as TemplateParams | null) || undefined;
  assertCampaignRecipientTemplates(
    template,
    templateParams,
    await withLiveContactFields(
      campaign.organizationId,
      whatsappNumber.id,
      failed.map((recipient) => ({
        name: recipient.name,
        phone: recipient.phone,
        variables: recipient.variables as { body?: string[]; header?: string[]; attributes?: Record<string, string> } | null,
      }))
    ),
    { name: campaign.templateName, language: templateLanguage }
  );
  const templateContent = applyTemplateParamsToPreview(template, templateParams, campaign.templateName);
  const runSnapshot = snapshotCampaignRun(campaign);
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
    throw new AppError(409, 'Campaign changed before retry could start');
  }
  const retryVersion = await prisma.campaign.findUnique({ where: { id: campaign.id }, select: { runVersion: true } });
  if (!retryVersion) {
    throw new AppError(404, 'Campaign not found');
  }
  const queuedJobIds: string[] = [];
  try {
    await reserveCampaignQuota(
      campaign.organizationId,
      campaign.id,
      retryVersion.runVersion,
      failed.length,
      billingCategory,
      whatsappNumber.id,
    );
    const reset = await prisma.campaignRecipient.updateMany({
      where: {
        campaignId: campaign.id,
        id: { in: failed.map((r) => r.id) },
        status: 'FAILED',
      },
      data: {
        status: 'PENDING',
        errorMessage: null,
        metaMessageId: null,
        claimToken: null,
        claimedAt: null,
        providerCallStartedAt: null,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        retryCount: { increment: 1 },
      },
    });
    if (reset.count !== failed.length) {
      throw new AppError(409, 'Recipients changed before retry could start');
    }

    const totalBatches = Math.ceil(failed.length / batchSize);
    for (let i = 0; i < failed.length; i += batchSize) {
    const batch = failed.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);
    const jobId = buildCampaignJobId(campaign.id, retryVersion.runVersion, 'retry', batch[0].id);
    await broadcastQueue.add(
      'send-broadcast-batch',
      {
        campaignId: campaign.id,
        organizationId: campaign.organizationId,
        whatsappNumberDbId: whatsappNumber.id,
        phoneNumberId: whatsappNumber.phoneNumberId,
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
      { delay: batchIndex * batchDelayMs, jobId }
    );
    queuedJobIds.push(jobId);
    }
  } catch (err) {
    await removeQueuedCampaignJobs(queuedJobIds);
    const rollback = await restoreCampaignRun(campaign.id, retryVersion.runVersion, runSnapshot);
    if (rollback && shouldReleaseCampaignQuota(rollback.ambiguousCount)) {
      await releaseCampaignQuota(campaign.id, retryVersion.runVersion);
    }
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
  if (!campaign.whatsappNumberId) {
    throw new AppError(409, 'Campaign has unresolved WhatsApp number ownership');
  }
  const maxGen = campaign.recipients.reduce((max, row) => Math.max(max, row.runGeneration ?? 0), 0);
  const latestRecipients = campaign.recipients.filter((row) => (row.runGeneration ?? 0) === maxGen);
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
      repeatIntervalDays: campaign.repeatIntervalDays,
      repeatUntil: campaign.repeatUntil,
      repeatMaxOccurrences: campaign.repeatMaxOccurrences,
      status: 'DRAFT',
      totalContacts: latestRecipients.length,
      createdById: userId ?? null,
      recipients: {
        create: latestRecipients.map((r) => ({
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
  if (!whatsappNumberId) return null;
  const latestGeneration = await prisma.campaignRecipient.aggregate({
    where: { campaignId },
    _max: { runGeneration: true },
  });
  const runGeneration = latestGeneration._max.runGeneration ?? 0;
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      organizationId: orgId,
      whatsappNumberId,
    },
    include: {
      recipients: {
        where: { runGeneration },
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
        await releaseCampaignQuota(campaign.id, campaign.runVersion);
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

export function canRescheduleCampaign(status: string) {
  return status === 'DRAFT' || status === 'SCHEDULED' || status === 'COMPLETED';
}

async function nextRecipientGeneration(campaignId: string) {
  const leftover = await prisma.campaignRecipient.aggregate({
    where: { campaignId },
    _max: { runGeneration: true },
  });
  return leftover._max.runGeneration == null ? 0 : leftover._max.runGeneration + 1;
}

async function seedPendingRecipientRun(
  campaignId: string,
  recipients: ResolvedRecipient[],
  runGeneration: number
) {
  const deduped = dedupeRecipients(recipients);
  if (!deduped.length) return 0;
  await prisma.campaignRecipient.createMany({
    data: deduped.map((r) => ({
      campaignId,
      phone: r.phone,
      name: r.name,
      variables: r.variables ? (r.variables as object) : undefined,
      runGeneration,
    })),
  });
  return deduped.length;
}

async function resolveRepeatAudience(campaign: Campaign): Promise<ResolvedRecipient[]> {
  if (!campaign.whatsappNumberId) {
    throw new AppError(409, 'Campaign has unresolved WhatsApp number ownership');
  }
  if (campaign.audienceType === 'MANUAL') {
    const maxGen = await prisma.campaignRecipient.aggregate({
      where: { campaignId: campaign.id },
      _max: { runGeneration: true },
    });
    const generation = maxGen._max.runGeneration ?? 0;
    const previous = await prisma.campaignRecipient.findMany({
      where: { campaignId: campaign.id, runGeneration: generation },
      select: { phone: true, name: true, variables: true },
    });
    return resolveAudienceRecipients(
      campaign.organizationId,
      'MANUAL',
      campaign.audienceConfig as AudienceConfig | null,
      previous.map((row) => ({
        phone: row.phone,
        name: row.name ?? undefined,
        variables: row.variables as ResolvedRecipient['variables'],
      })),
      campaign.whatsappNumberId
    );
  }
  return resolveAudienceRecipients(
    campaign.organizationId,
    campaign.audienceType as AudienceType,
    campaign.audienceConfig as AudienceConfig | null,
    [],
    campaign.whatsappNumberId
  );
}

export async function scheduleNextRepeatIfNeeded(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== 'COMPLETED' || campaign.cancelledAt) return false;
  if (!campaign.repeatIntervalDays || campaign.repeatIntervalDays < 1) return false;

  const nextAt = nextRepeatInstant({
    lastScheduledAt: campaign.scheduledAt,
    completedAt: new Date(),
    intervalDays: campaign.repeatIntervalDays,
    timeZone: campaign.timezone,
  });
  if (
    !shouldScheduleRepeat({
      repeatIntervalDays: campaign.repeatIntervalDays,
      repeatUntil: campaign.repeatUntil,
      repeatMaxOccurrences: campaign.repeatMaxOccurrences,
      repeatOccurrenceCount: campaign.repeatOccurrenceCount,
      nextAt,
    })
  ) {
    return false;
  }

  let resolved: ResolvedRecipient[];
  try {
    resolved = await resolveRepeatAudience(campaign);
  } catch (err) {
    await logCampaignAudit(campaign.organizationId, undefined, 'campaign.repeat_seed_failed', {
      campaignId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
  if (!resolved.length) return false;

  const pending = await prisma.campaignRecipient.count({
    where: { campaignId, status: 'PENDING' },
  });
  if (pending === 0) {
    await seedPendingRecipientRun(campaignId, resolved, await nextRecipientGeneration(campaignId));
  }

  const claimed = await prisma.campaign.updateMany({
    where: { id: campaignId, status: 'COMPLETED', cancelledAt: null },
    data: {
      status: 'SCHEDULED',
      scheduledAt: nextAt,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      totalContacts: resolved.length,
      pausedAt: null,
    },
  });
  if (claimed.count !== 1) return false;
  emitToOrg(campaign.organizationId, 'campaign:status', { campaignId, status: 'SCHEDULED' });
  await logCampaignAudit(campaign.organizationId, undefined, 'campaign.repeat_scheduled', {
    campaignId,
    scheduledAt: nextAt.toISOString(),
    intervalDays: campaign.repeatIntervalDays,
  });
  return true;
}

export async function scheduleDripFollowUpIfNeeded(campaignId: string): Promise<boolean> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== 'COMPLETED' || campaign.cancelledAt) return false;

  const audienceConfig = (campaign.audienceConfig as AudienceConfig | null) || {};
  const drip = audienceConfig?.drip;
  if (!drip?.enabled || !drip.templateName?.trim() || drip.isStep2) return false;
  if (!campaign.whatsappNumberId) return false;

  const existing = await prisma.campaign.findFirst({
    where: {
      organizationId: campaign.organizationId,
      name: `${campaign.name} (Follow-Up Step 2)`,
    },
    select: { id: true },
  });
  if (existing) return false;

  const delayHours = Math.max(1, Math.min(168, Number(drip.delayHours) || 24));
  const scheduledAt = new Date(Date.now() + delayHours * 60 * 60 * 1000);

  const followUp = await prisma.campaign.create({
    data: {
      organizationId: campaign.organizationId,
      name: `${campaign.name} (Follow-Up Step 2)`,
      templateName: drip.templateName.trim(),
      templateLanguage: drip.templateLanguage || campaign.templateLanguage || 'en',
      templateParams: drip.templateParams ? (drip.templateParams as object) : undefined,
      audienceType: 'CONTACTS',
      audienceConfig: {
        ...audienceConfig,
        drip: {
          ...drip,
          parentCampaignId: campaignId,
          isStep2: true,
        },
      } as object,
      whatsappNumberId: campaign.whatsappNumberId,
      status: 'SCHEDULED',
      scheduledAt,
      timezone: campaign.timezone,
      totalContacts: 0,
      createdById: campaign.createdById,
    },
  });

  emitToOrg(campaign.organizationId, 'campaign:status', { campaignId: followUp.id, status: 'SCHEDULED' });
  await logCampaignAudit(campaign.organizationId, campaign.createdById ?? undefined, 'campaign.drip_scheduled', {
    parentCampaignId: campaignId,
    dripCampaignId: followUp.id,
    scheduledAt: scheduledAt.toISOString(),
    delayHours,
    condition: drip.condition || 'no_reply',
  });

  return true;
}

export async function rescheduleCampaign(
  campaign: Campaign,
  scheduledAt: Date,
  extras?: {
    timezone?: string;
    repeatIntervalDays?: number | null;
    repeatUntil?: string | null;
    repeatMaxOccurrences?: number | null;
  }
) {
  if (campaign.status === 'RUNNING') {
    throw new AppError(409, 'Cannot reschedule a campaign that is currently sending');
  }
  if (campaign.status === 'PAUSED') {
    throw new AppError(409, 'Resume or cancel this campaign before changing the send time');
  }
  if (campaign.status === 'CANCELLED') {
    throw new AppError(400, 'Cancelled campaigns cannot be rescheduled');
  }
  if (!canRescheduleCampaign(campaign.status)) {
    throw new AppError(400, 'This campaign cannot be rescheduled');
  }
  if (scheduledAt.getTime() <= Date.now()) {
    throw new AppError(400, 'Pick a future send time');
  }

  const repeatWrite = extras ? campaignRepeatWrite(extras) : {};

  if (campaign.status === 'COMPLETED') {
    const pending = await prisma.campaignRecipient.count({
      where: { campaignId: campaign.id, status: 'PENDING' },
    });
    if (pending === 0) {
      const resolved = await resolveRepeatAudience(campaign);
      if (!resolved.length) {
        throw new AppError(400, 'No recipients match the selected audience');
      }
      await seedPendingRecipientRun(campaign.id, resolved, await nextRecipientGeneration(campaign.id));
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: 'SCHEDULED',
          scheduledAt,
          timezone: extras?.timezone ?? campaign.timezone,
          ...repeatWrite,
          sentCount: 0,
          deliveredCount: 0,
          readCount: 0,
          failedCount: 0,
          totalContacts: resolved.length,
          pausedAt: null,
        },
      });
      return;
    }
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      scheduledAt,
      timezone: extras?.timezone ?? campaign.timezone,
      ...repeatWrite,
      status: 'SCHEDULED',
    },
  });
}

export async function persistRecipients(
  campaignId: string,
  recipients: ResolvedRecipient[],
  expectedRunVersion?: number,
  options: { bumpRunVersion?: boolean } = {}
) {
  const deduped = dedupeRecipients(recipients);
  const bumpRunVersion = options.bumpRunVersion ?? true;
  await prisma.$transaction(async (tx) => {
    if (expectedRunVersion !== undefined) {
      await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${campaignId} FOR UPDATE`;
      const current = await tx.campaign.findFirst({
        where: {
          id: campaignId,
          status: { in: bumpRunVersion ? ['DRAFT', 'SCHEDULED'] : ['RUNNING'] },
          runVersion: expectedRunVersion,
        },
        select: { id: true },
      });
      if (!current) {
        throw new AppError(409, 'Campaign changed while recipients were being updated; try again');
      }
      if (bumpRunVersion) {
        await tx.campaign.update({
          where: { id: campaignId },
          data: { runVersion: { increment: 1 } },
        });
      }
    }
    await tx.campaignRecipient.deleteMany({ where: { campaignId, status: 'PENDING' } });
    const leftover = await tx.campaignRecipient.aggregate({
      where: { campaignId },
      _max: { runGeneration: true },
    });
    const runGeneration =
      leftover._max.runGeneration == null ? 0 : leftover._max.runGeneration + 1;
    await tx.campaignRecipient.createMany({
      data: deduped.map((r) => ({
        campaignId,
        phone: r.phone,
        name: r.name,
        variables: r.variables ? (r.variables as object) : undefined,
        runGeneration,
      })),
    });
    await tx.campaign.update({
      where: { id: campaignId },
      data: { totalContacts: deduped.length },
    });
  });
  return deduped.length;
}

export { getTemplateDisplayText };
