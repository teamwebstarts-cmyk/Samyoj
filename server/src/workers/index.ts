import { Worker, Job } from 'bullmq';
import { Server } from 'socket.io';
import type { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { config } from '../config';
import { MetaWhatsAppService } from '../modules/whatsapp/meta.service';
import { resolveMetaCredentials } from '../modules/whatsapp/org-meta.service';
import { deliverOutboundMessage } from '../modules/messages/send.service';
import { retryDelays } from '../config/queues';
import { processWebhookFields } from '../modules/calling/call.processor';
import { processWebhookPayload } from './webhook.processor';
import { processAiChatbotJob } from '../modules/automation/engine';
import { executeWebhookDelivery } from '../modules/integrations/dispatch';
import { processCompliancePurge } from './compliance-purge.processor';
import { pollConversationAnalytics, pollQualityRatings } from '../modules/billing/usage.service';
import { attachWorkerErrorHandlers, logError } from '../errors';
import { createModuleLogger } from '../utils/logger';
import { hasAuditableCampaignConsent } from '../modules/campaigns/recipients';
import {
  buildStaleCampaignJobAudit,
  buildConsentSnapshot,
  campaignCounterSnapshot,
  isCampaignConfigurationFailure,
  newClaimToken,
  classifyProviderError,
  classifyProviderBoundaryOutcome,
  classifyClaimForConfigurationFailure,
  shouldReleaseQuotaAfterConfigurationFailure,
} from '../modules/campaigns/safety';
import { campaignJobClaimPrefix, isBroadcastJobContextValid } from '../modules/campaigns/worker-safety';
import { releaseCampaignQuota } from '../modules/campaigns/quota';
import { logCampaignAudit } from '../modules/campaigns/audit';
import { assertApprovedCampaignTemplate, assertApprovedTemplateIdentity } from '../modules/campaigns/template-validation';
import { billingCategoryForTemplate } from '../modules/campaigns/types';
import { trackWebhookFailed, trackWebhookProcessed } from '../modules/whatsapp/webhook-health';
import { safeRecordMetaSendFailure } from '../modules/platform/meta-errors';
import { startPlatformTelemetryWorker } from '../modules/platform/worker';

const log = createModuleLogger('worker');

if (require.main === module) {
  log.error(
    'Workers are embedded in the API (startWorkers()). Do not start a second consumer via npm run start:worker / whatsapp-worker.'
  );
  process.exit(1);
}

const connection = { url: config.redisUrl };

let io: Server | null = null;
let workersStarted = false;

export function setSocketIO(socketServer: Server) {
  io = socketServer;
}

function getRetryDelay(attemptsMade: number): number {
  return retryDelays[Math.min(attemptsMade, retryDelays.length - 1)];
}

async function cleanStaleCampaignJob(job: Job, input: {
  campaignId: string;
  organizationId: string;
  runVersion: number;
  reason: 'campaign_missing' | 'context_mismatch';
}) {
  const live = await prisma.campaign.findFirst({
    where: { id: input.campaignId, organizationId: input.organizationId },
    select: { status: true, runVersion: true },
  });
  let releasedClaimCount = 0;
  if (live?.runVersion === input.runVersion) {
    const released = await prisma.campaignRecipient.updateMany({
      where: {
        campaignId: input.campaignId,
        status: 'PENDING',
        providerCallStartedAt: null,
        claimToken: { startsWith: campaignJobClaimPrefix(job.id ?? 'unknown') },
        campaign: { organizationId: input.organizationId, runVersion: input.runVersion },
      },
      data: {
        status: 'FAILED',
        errorMessage: 'Stale campaign job discarded before provider send',
        claimToken: null,
        claimedAt: null,
      },
    });
    releasedClaimCount = released.count;
    await prisma.$transaction(async (tx) => {
      const recipients = await tx.campaignRecipient.findMany({
        where: { campaignId: input.campaignId },
        select: { status: true },
      });
      const counts = campaignCounterSnapshot(recipients.map((row) => row.status));
      await tx.campaign.updateMany({
        where: { id: input.campaignId, organizationId: input.organizationId, runVersion: input.runVersion },
        data: counts,
      });
    });
  }
  await logCampaignAudit(
    input.organizationId,
    undefined,
    'campaign.stale_job',
    buildStaleCampaignJobAudit({
      campaignId: input.campaignId,
      jobId: job.id ?? 'unknown',
      expectedRunVersion: input.runVersion,
      liveRunVersion: live?.runVersion,
      liveStatus: live?.status,
      reason: input.reason,
      releasedClaimCount,
    })
  );
}

export function areWorkersStarted(): boolean {
  return workersStarted;
}

export function startWorkers(): void {
  process.env.SAMYOJ_EMBEDDED_WORKERS = '1';
  if (workersStarted) return;
  workersStarted = true;
  startPlatformTelemetryWorker();

// Webhook worker — handle inbound messages + status ticks (processWebhookPayload)
// as well as voice-call webhooks (processWebhookFields). Both share the same
// Meta payload shape, so run both processors.
const webhookWorker = new Worker(
  'webhook-queue',
  async (job: Job) => {
    const payload = job.data?.payload;
    if (!payload) return;
    try {
      await processWebhookFields(payload);
      await processWebhookPayload(payload, {
        whatsappNumberId: job.data?.whatsappNumberId,
      });
      trackWebhookProcessed();
    } catch (err) {
      // Count terminal worker failures once; transient BullMQ retry attempts
      // are not completed jobs and must not inflate monitoring totals.
      const maxAttempts = job.opts.attempts ?? 1;
      if ((job.attemptsMade ?? 0) + 1 >= maxAttempts) {
        trackWebhookFailed(err);
      }
      throw err;
    }
  },
  {
    connection,
    lockDuration: 120_000,
    settings: {
      backoffStrategy: (attemptsMade: number) => getRetryDelay(attemptsMade),
    },
  }
);

attachWorkerErrorHandlers(webhookWorker, 'webhook-queue');

// Message send worker (retries / automation)
const messageWorker = new Worker(
  'message-queue',
  async (job: Job) => {
    const {
      messageId,
      organizationId,
      whatsappNumberId,
      phoneNumberId,
      encryptedToken,
      to,
      content,
      type,
      templateName,
      templateLanguage,
      templateParams,
      buttons,
      interactive,
      location,
      contacts,
      waFlow,
      mediaUrl,
      mediaCaption,
    } = job.data;

    if (!messageId) return;

    const existing = await prisma.message.findUnique({
      where: { id: messageId },
      select: { status: true },
    });
    if (!existing || existing.status === 'SENT' || existing.status === 'FAILED') {
      return;
    }

    await deliverOutboundMessage({
      organizationId,
      whatsappNumberId,
      messageId,
      phoneNumberId,
      encryptedToken,
      to,
      content,
      type: type || 'TEXT',
      templateName,
      templateLanguage,
      templateParams,
      buttons,
      interactive,
      location,
      contacts,
      waFlow,
      mediaUrl,
      mediaCaption,
    });
  },
  {
    connection,
    settings: {
      backoffStrategy: (attemptsMade: number) => getRetryDelay(attemptsMade),
    },
  }
);

attachWorkerErrorHandlers(messageWorker, 'message-queue');

// Broadcast worker
const broadcastWorker = new Worker(
  'broadcast-queue',
  async (job: Job) => {
    const {
      campaignId,
      organizationId,
      whatsappNumberDbId,
      phoneNumberId,
      encryptedToken,
      wabaId,
      templateName,
      templateLanguage,
      templateContent,
      templateParams,
      recipients,
      runVersion,
    } = job.data;

    if (!Number.isInteger(runVersion)) {
      throw new Error('Campaign job missing runVersion. Legacy jobs must be re-enqueued.');
    }
    if (!phoneNumberId || !encryptedToken) {
      throw new Error('Campaign job missing WhatsApp credentials. Re-send the campaign from the UI.');
    }

    const campaign = await prisma.campaign.findUnique({
      where: {
        id: campaignId,
        organizationId,
        whatsappNumberId: whatsappNumberDbId,
      },
      select: {
        id: true,
        status: true,
        runVersion: true,
        organizationId: true,
        whatsappNumberId: true,
        organization: { select: { companyName: true } },
        whatsappNumber: { select: { businessId: true, phoneNumberId: true, wabaId: true } },
      },
    });
    if (!campaign) {
      await cleanStaleCampaignJob(job, {
        campaignId,
        organizationId,
        runVersion,
        reason: 'campaign_missing',
      });
      return;
    }
    if (!isBroadcastJobContextValid({
      campaignId,
      organizationId,
      whatsappNumberDbId,
      phoneNumberId,
      wabaId,
      runVersion,
    }, campaign)) {
      await cleanStaleCampaignJob(job, {
        campaignId,
        organizationId,
        runVersion,
        reason: 'context_mismatch',
      });
      return;
    }

    const accessToken = MetaWhatsAppService.decryptToken(encryptedToken);
    const { emitToOrg } = await import('../realtime');
    if (wabaId) {
      try {
        const metaCredentials = await resolveMetaCredentials(organizationId);
        await MetaWhatsAppService.ensureWabaSubscribed(wabaId, accessToken, metaCredentials);
      } catch (err) {
        const classified = classifyProviderError(err);
        if (!isCampaignConfigurationFailure(classified.classification)) {
          // Network, throttling, and 5xx failures must retain BullMQ retry
          // semantics; no recipient has crossed the provider boundary yet.
          throw err;
        }
        const configurationMessage =
          `Campaign blocked by WhatsApp configuration: ${classified.message} ` +
          'Reconnect WhatsApp with a WABA admin account, then retry failed recipients.';
        await prisma.$transaction(async (tx) => {
          const providerBound = await tx.campaignRecipient.updateMany({
            where: {
              campaignId,
              campaign: { organizationId, status: 'RUNNING', runVersion },
              status: 'PENDING',
              providerCallStartedAt: { not: null },
            },
            data: {
              status: 'AMBIGUOUS',
              errorMessage: `${configurationMessage} Provider call started; reconcile with Meta before retrying.`,
              claimToken: null,
              claimedAt: null,
            },
          });
          const unstarted = await tx.campaignRecipient.findMany({
            where: {
              campaignId,
              campaign: { organizationId, status: 'RUNNING', runVersion },
              status: 'PENDING',
            },
            select: { id: true, status: true, providerCallStartedAt: true },
          });
          let failed = 0;
          for (const row of unstarted) {
            const next = classifyClaimForConfigurationFailure(row);
            if (next !== 'FAILED') continue;
            const released = await tx.campaignRecipient.updateMany({
              where: { id: row.id, status: 'PENDING', providerCallStartedAt: null },
              data: {
                status: 'FAILED',
                errorMessage: configurationMessage,
                claimToken: null,
                claimedAt: null,
              },
            });
            failed += released.count;
          }
          await tx.campaign.updateMany({
            where: { id: campaignId, organizationId, status: 'RUNNING', runVersion },
            data: { status: 'FAILED' },
          });
          return { failed, ambiguous: providerBound.count };
        });
        const { reconcileCampaignCounters } = await import('../modules/campaigns/service');
        await reconcileCampaignCounters(campaignId);
        const rollbackSafetyRows = await prisma.campaignRecipient.findMany({
          where: { campaignId },
          select: { status: true, claimToken: true, providerCallStartedAt: true },
        });
        // No fake Meta reconciliation is attempted here. An in-flight provider
        // boundary keeps this failed campaign's reservation until reconciliation.
        if (shouldReleaseQuotaAfterConfigurationFailure(rollbackSafetyRows)) {
          await releaseCampaignQuota(campaignId, runVersion);
        }
        emitToOrg(organizationId, 'campaign:status', {
          campaignId,
          status: 'FAILED',
          reason: 'WHATSAPP_CONFIGURATION',
          errorMessage: configurationMessage,
        });
        return;
      }
    }
    const lang = templateLanguage || 'en_US';

    const { recordOutboundInConversation } = await import('../modules/messages/service');
    const { buildTemplateComponents, mergeTemplateParams } = await import('../modules/campaigns/template-params');

    const templateMeta = await MetaWhatsAppService.getMessageTemplate(wabaId, accessToken, templateName);
    assertApprovedTemplateIdentity(templateMeta, {
      name: templateName,
      language: lang,
    });

    for (const recipient of recipients) {
        const live = await prisma.campaign.findUnique({
        where: { id: campaignId },
          select: { status: true, runVersion: true },
      });
        if (!live || live.status !== 'RUNNING' || live.runVersion !== runVersion) break;

      const contact = await prisma.contact.findUnique({
        where: {
          organizationId_whatsappNumberId_normalizedPhone: {
            organizationId,
            whatsappNumberId: whatsappNumberDbId,
            normalizedPhone: recipient.phone,
          },
        },
        select: {
          optedIn: true, consentSource: true, consentAt: true, consentVersion: true,
          consentDecision: true, optOutAt: true, updatedAt: true,
        },
      });
      if (!contact || !hasAuditableCampaignConsent(contact)) {
        const rejected = await prisma.campaignRecipient.updateMany({
          where: {
            id: recipient.id,
            campaignId,
            status: 'PENDING',
            claimToken: null,
            providerCallStartedAt: null,
            campaign: { organizationId, status: 'RUNNING', runVersion },
          },
          data: {
            status: 'FAILED',
            errorMessage: 'Recipient has no active, auditable campaign consent',
          },
        });
        if (rejected.count === 1) {
          await prisma.campaign.updateMany({
            where: { id: campaignId, organizationId, status: 'RUNNING', runVersion },
            data: { failedCount: { increment: 1 } },
          });
        }
        continue;
      }

      const claimToken = newClaimToken(String(job.id), recipient.id);
      const claimed = await prisma.campaignRecipient.updateMany({
        where: {
          id: recipient.id,
          status: 'PENDING',
          OR: [{ claimToken: null }, { claimedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } }],
          providerCallStartedAt: null,
          campaign: { id: campaignId, organizationId, status: 'RUNNING', runVersion },
        },
        data: {
          claimToken,
          claimedAt: new Date(),
          providerCallStartedAt: null,
          consentSnapshot: buildConsentSnapshot({
            phone: recipient.phone,
            business: {
              organizationId,
              name: campaign.organization.companyName,
              businessId: campaign.whatsappNumber?.businessId,
              phoneNumberId: campaign.whatsappNumber?.phoneNumberId,
            },
            category: billingCategoryForTemplate(templateMeta?.category),
            policyVersion: 'campaign-consent-v1',
            contact,
          }),
        },
      });
      if (claimed.count !== 1) continue;

      // This is the final database boundary before Meta. A committed pause/cancel
      // increments runVersion and makes this lease refresh fail. Meta calls are
      // external, so a crash after this check can still leave an accepted send.
      const preSend = await prisma.campaignRecipient.updateMany({
        where: {
          id: recipient.id,
          claimToken,
          campaign: { status: 'RUNNING', runVersion: campaign.runVersion },
        },
        data: { claimedAt: new Date() },
      });
      if (preSend.count !== 1) continue;

      // Re-read consent at the last transactional boundary. An opt-out after
      // this commit races the external call and is therefore auditable/ambiguous.
      const sendBoundary = await prisma.$transaction(async (tx) => {
        const latestContact = await tx.contact.findUnique({
          where: {
            organizationId_whatsappNumberId_normalizedPhone: {
              organizationId,
              whatsappNumberId: whatsappNumberDbId,
              normalizedPhone: recipient.phone,
            },
          },
          select: {
            optedIn: true, consentSource: true, consentAt: true, consentVersion: true,
            consentDecision: true, optOutAt: true, name: true, phone: true, email: true,
            customAttributes: true,
          },
        });
        if (!latestContact || !hasAuditableCampaignConsent(latestContact)) {
          const rejected = await tx.campaignRecipient.updateMany({
            where: {
              id: recipient.id,
              claimToken,
              status: 'PENDING',
              campaign: { status: 'RUNNING', runVersion: campaign.runVersion },
            },
            data: {
              status: 'FAILED',
              errorMessage: 'Recipient opted out or lacks active consent before provider send',
              claimToken: null,
              claimedAt: null,
              providerCallStartedAt: null,
            },
          });
          return { allowed: false, rejected: rejected.count === 1, contact: latestContact };
        }
        const marked = await tx.campaignRecipient.updateMany({
          where: {
            id: recipient.id,
            claimToken,
            status: 'PENDING',
            providerCallStartedAt: null,
            campaign: { status: 'RUNNING', runVersion: campaign.runVersion },
          },
          data: { providerCallStartedAt: new Date(), consentSnapshot: buildConsentSnapshot({
            phone: recipient.phone,
            business: {
              organizationId,
              name: campaign.organization.companyName,
              businessId: campaign.whatsappNumber?.businessId,
              phoneNumberId: campaign.whatsappNumber?.phoneNumberId,
            },
            category: billingCategoryForTemplate(templateMeta?.category),
            policyVersion: 'campaign-consent-v1',
            contact: latestContact,
          }) },
        });
        return { allowed: marked.count === 1, rejected: false, contact: latestContact };
      });
      if (!sendBoundary.allowed) {
        if (sendBoundary.rejected) {
          await prisma.campaign.updateMany({
            where: { id: campaignId, organizationId, status: 'RUNNING', runVersion },
            data: { failedCount: { increment: 1 } },
          });
        }
        continue;
      }

      const mergedParams = mergeTemplateParams(
        templateParams,
        recipient.variables,
        sendBoundary.contact?.name || recipient.name,
        templateMeta,
        {
          name: sendBoundary.contact?.name || recipient.name,
          phone: sendBoundary.contact?.phone || recipient.phone,
          email: sendBoundary.contact?.email,
          customAttributes: sendBoundary.contact?.customAttributes,
        }
      );
      try {
        assertApprovedCampaignTemplate(templateMeta, {
          name: templateName,
          language: lang,
          params: mergedParams,
        });
      } catch (templateError) {
        const rejected = await prisma.campaignRecipient.updateMany({
          where: {
            id: recipient.id,
            campaignId,
            status: 'PENDING',
            claimToken,
            campaign: { organizationId, status: 'RUNNING', runVersion },
          },
          data: {
            status: 'FAILED',
            errorMessage: templateError instanceof Error ? templateError.message : String(templateError),
            claimToken: null,
            claimedAt: null,
            providerCallStartedAt: null,
          },
        });
        if (rejected.count === 1) {
          await prisma.campaign.updateMany({
            where: { id: campaignId, organizationId, status: 'RUNNING', runVersion },
            data: { failedCount: { increment: 1 } },
          });
        }
        continue;
      }
      const components = buildTemplateComponents(mergedParams, templateMeta);

      try {
        const result = await MetaWhatsAppService.sendMessage(phoneNumberId, accessToken, {
          to: recipient.phone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: lang },
            ...(components.length ? { components } : {}),
          },
        });

        const metaMessageId = result.messages?.[0]?.id;
        if (whatsappNumberDbId) {
          await recordOutboundInConversation({
            organizationId,
            whatsappNumberId: whatsappNumberDbId,
            phone: recipient.phone,
            name: recipient.name,
            content: templateContent || `Template: ${templateName}`,
            type: 'TEMPLATE',
            status: 'SENT',
            metaMessageId,
            metadata: { templateName, templateLanguage: lang, campaignId },
          });
        }

        const completed = await prisma.campaignRecipient.updateMany({
          where: {
            id: recipient.id,
            claimToken,
            campaign: { status: 'RUNNING', runVersion: campaign.runVersion },
          },
          data: {
            status: 'SENT',
            metaMessageId,
            sentAt: new Date(),
            errorMessage: null,
            claimToken: null,
            claimedAt: null,
            providerCallStartedAt: null,
          },
        });
        if (completed.count !== 1) {
          // Meta may have accepted the request while pause/cancel committed.
          // Record that ambiguous outcome so lease recovery never retries it.
          await prisma.campaignRecipient.updateMany({
            where: {
              id: recipient.id,
              claimToken,
              campaign: { id: campaignId, organizationId, status: 'RUNNING', runVersion },
            },
            data: {
              status: 'AMBIGUOUS',
              metaMessageId,
              errorMessage: 'Provider accepted before campaign pause/cancel; reconcile with Meta status',
              claimToken: null,
              claimedAt: null,
            },
          });
        }
        if (metaMessageId) {
          const { reconcileUnmatchedProviderStatuses } = await import('../modules/whatsapp/provider-status');
          await reconcileUnmatchedProviderStatuses({
            organizationId,
            metaMessageId,
            whatsappNumberId: whatsappNumberDbId,
            phoneNumberId,
          });
        }
        const { reconcileCampaignCounters } = await import('../modules/campaigns/service');
        await reconcileCampaignCounters(campaignId);

        emitToOrg(organizationId, 'campaign:progress', {
          campaignId,
          recipientId: recipient.id,
          status: 'SENT',
        });
      } catch (err) {
        const classified = classifyProviderError(err);
        const errorMessage = classified.message;
        void safeRecordMetaSendFailure({
          organizationId,
          whatsappNumberId: whatsappNumberDbId,
          error: err,
        });
        logError(err, {
          source: 'worker',
          queueName: 'broadcast-queue',
          jobId: job.id,
          path: `recipient:${recipient.phone}`,
        });

        const currentRecipient = await prisma.campaignRecipient.findUnique({
          where: { id: recipient.id },
          select: { consentSnapshot: true },
        });
        const providerSnapshot = {
          ...((currentRecipient?.consentSnapshot as Record<string, unknown> | null) ?? {}),
          providerError: classified.metadata,
          providerErrorMessage: errorMessage,
          providerErrorClassification: classified.classification,
        };
        const durableFailure = classifyProviderBoundaryOutcome(classified.classification) === 'FAILED';
        const ambiguous = await prisma.campaignRecipient.updateMany({
          where: {
            id: recipient.id,
            claimToken,
            campaign: { id: campaignId, organizationId, status: 'RUNNING', runVersion },
          },
          data: {
            status: durableFailure ? 'FAILED' : 'AMBIGUOUS',
            errorMessage: durableFailure
              ? `Meta rejected before acceptance: ${errorMessage}`
              : `Provider outcome unknown; reconcile with Meta before retrying: ${errorMessage}`,
            consentSnapshot: providerSnapshot as Prisma.InputJsonValue,
            claimToken: null,
            claimedAt: null,
            ...([
              'PERMANENT_REJECTION',
              'CONFIGURATION_ERROR',
              'AUTHENTICATION_ERROR',
              'POLICY_REJECTION',
            ].includes(classified.classification)
              ? { providerCallStartedAt: null }
              : {}),
          },
        });
        if (ambiguous.count === 1 && durableFailure) {
          await prisma.campaign.updateMany({
            where: { id: campaignId, organizationId, status: 'RUNNING', runVersion },
            data: { failedCount: { increment: 1 } },
          });
        }
        const { reconcileCampaignCounters } = await import('../modules/campaigns/service');
        await reconcileCampaignCounters(campaignId);

        emitToOrg(organizationId, 'campaign:progress', {
          campaignId,
          recipientId: recipient.id,
          status: durableFailure ? 'FAILED' : 'AMBIGUOUS',
          errorMessage,
        });
      }
    }

    const { finalizeCampaignIfDone } = await import('../modules/campaigns/service');
    await finalizeCampaignIfDone(campaignId, runVersion);
  },
  {
    connection,
    concurrency: 2,
    settings: {
      backoffStrategy: (attemptsMade: number) => getRetryDelay(attemptsMade),
    },
  }
);

attachWorkerErrorHandlers(broadcastWorker, 'broadcast-queue');

// AI automation worker
const automationWorker = new Worker(
  'automation-queue',
  async (job: Job) => {
    if (job.name === 'ai-chatbot') {
      await processAiChatbotJob(job.data);
    }
  },
  {
    connection,
    concurrency: 5,
    settings: {
      backoffStrategy: (attemptsMade: number) => getRetryDelay(attemptsMade),
    },
  }
);

attachWorkerErrorHandlers(automationWorker, 'automation-queue');

// Flow delay/resume worker
const flowWorker = new Worker(
  'flow-queue',
  async (job: Job) => {
    if (job.name === 'resume-flow') {
      const { resumeFlowAfterDelay } = await import('../modules/flows/engine');
      await resumeFlowAfterDelay(job.data);
    }
    if (job.name === 'start-flow') {
      const { startFlowFromJob } = await import('../modules/flows/engine');
      await startFlowFromJob(job.data);
    }
    if (job.name === 'retry-inbound') {
      const { handleInboundAutomations } = await import('../modules/automation/engine');
      await handleInboundAutomations(job.data);
    }
  },
  {
    connection,
    concurrency: 10,
    settings: {
      backoffStrategy: (attemptsMade: number) => getRetryDelay(attemptsMade),
    },
  }
);

attachWorkerErrorHandlers(flowWorker, 'flow-queue');

// Outbound webhook dispatch worker
const webhookDispatchWorker = new Worker(
  'webhook-dispatch',
  async (job: Job) => {
    await executeWebhookDelivery(job.data.deliveryId);
  },
  {
    connection,
    concurrency: 5,
    settings: {
      backoffStrategy: (attemptsMade: number) => getRetryDelay(attemptsMade),
    },
  }
);

attachWorkerErrorHandlers(webhookDispatchWorker, 'webhook-dispatch');

// GDPR compliance purge worker
const compliancePurgeWorker = new Worker(
  'compliance-purge',
  async (job: Job) => {
    await processCompliancePurge(job.data.organizationId);
  },
  { connection, concurrency: 1 }
);

attachWorkerErrorHandlers(compliancePurgeWorker, 'compliance-purge');

const contentImageWorker = new Worker(
  'content-image',
  async (job: Job) => {
    const { processImageGenerationJob } = await import('../modules/content-studio/images/routes');
    await processImageGenerationJob(job.data.jobId, job.data.organizationId);
  },
  {
    connection,
    concurrency: 3,
    settings: {
      backoffStrategy: (attemptsMade: number) => getRetryDelay(attemptsMade),
    },
  }
);

attachWorkerErrorHandlers(contentImageWorker, 'content-image');

const contentVoiceWorker = new Worker(
  'content',
  async (job: Job) => {
    if (job.name === 'generate-voice') {
      const { processVoiceGenerationJob } = await import('../modules/content-studio/voices/routes');
      await processVoiceGenerationJob(job.data.jobId, job.data.organizationId);
    }
  },
  {
    connection,
    concurrency: 2,
    settings: {
      backoffStrategy: (attemptsMade: number) => getRetryDelay(attemptsMade),
    },
  }
);

attachWorkerErrorHandlers(contentVoiceWorker, 'content');

const contentVideoWorker = new Worker(
  'content-video',
  async (job: Job) => {
    const { processVideoGenerationJob } = await import('../modules/content-studio/videos/routes');
    await processVideoGenerationJob(job.data.jobId, job.data.organizationId);
  },
  {
    connection,
    concurrency: 2,
    settings: {
      backoffStrategy: (attemptsMade: number) => getRetryDelay(attemptsMade),
    },
  }
);

attachWorkerErrorHandlers(contentVideoWorker, 'content-video');

log.info('Workers started', {
  queues: [
    'webhook-queue',
    'message-queue',
    'broadcast-queue',
    'automation-queue',
    'flow-queue',
    'webhook-dispatch',
    'compliance-purge',
    'content-image',
    'content',
    'content-video',
  ],
});

// Daily billing analytics poll (every 24 hours)
setInterval(() => {
  pollConversationAnalytics().catch((err) =>
    logError(err, { source: 'worker', action: 'pollConversationAnalytics' })
  );
  pollQualityRatings().catch((err) =>
    logError(err, { source: 'worker', action: 'pollQualityRatings' })
  );
}, 24 * 60 * 60 * 1000);

// Scheduled campaign processor (every minute)
setInterval(() => {
  import('../modules/campaigns/service')
    .then(({ processScheduledCampaigns }) => processScheduledCampaigns())
    .catch((err) => logError(err, { source: 'worker', action: 'processScheduledCampaigns' }));
}, 60_000);

}

// Standalone entry is refused at module load (`require.main === module` above).
// In-process `startWorkers()` from `src/index.ts` remains the only supported path.
