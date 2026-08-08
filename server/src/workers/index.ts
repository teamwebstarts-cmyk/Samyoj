import { Worker, Job } from 'bullmq';
import { Server } from 'socket.io';
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
import { attachWorkerErrorHandlers, logError, setupGlobalErrorHandlers } from '../errors';
import { checkRedisConnection } from '../config/redis';
import { createModuleLogger } from '../utils/logger';
import { hasAuditableCampaignConsent } from '../modules/campaigns/recipients';
import { buildConsentSnapshot, newClaimToken } from '../modules/campaigns/safety';

const log = createModuleLogger('worker');

const connection = { url: config.redisUrl };

let io: Server | null = null;
let workersStarted = false;

export function setSocketIO(socketServer: Server) {
  io = socketServer;
}

function getRetryDelay(attemptsMade: number): number {
  return retryDelays[Math.min(attemptsMade, retryDelays.length - 1)];
}

export function startWorkers(): void {
  if (workersStarted) return;
  workersStarted = true;

// Webhook worker — handle inbound messages + status ticks (processWebhookPayload)
// as well as voice-call webhooks (processWebhookFields). Both share the same
// Meta payload shape, so run both processors.
const webhookWorker = new Worker(
  'webhook-queue',
  async (job: Job) => {
    const payload = job.data?.payload;
    if (!payload) return;
    await processWebhookPayload(payload);
    await processWebhookFields(payload);
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

    if (!phoneNumberId || !encryptedToken) {
      throw new Error('Campaign job missing WhatsApp credentials. Re-send the campaign from the UI.');
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        status: true,
        runVersion: true,
        organization: { select: { companyName: true } },
        whatsappNumber: { select: { businessId: true, phoneNumberId: true } },
      },
    });
    if (!campaign || campaign.status !== 'RUNNING' || (runVersion !== undefined && campaign.runVersion !== runVersion)) {
      return;
    }

    const accessToken = MetaWhatsAppService.decryptToken(encryptedToken);
    if (wabaId) {
      const metaCredentials = await resolveMetaCredentials(organizationId);
      await MetaWhatsAppService.ensureWabaSubscribed(wabaId, accessToken, metaCredentials);
    }
    const lang = templateLanguage || 'en_US';

    const { recordOutboundInConversation } = await import('../modules/messages/service');
    const { buildTemplateComponents, mergeTemplateParams } = await import('../modules/campaigns/template-params');
    const { emitToOrg } = await import('../realtime');

    let templateMeta = null;
    try {
      templateMeta = await MetaWhatsAppService.getMessageTemplate(wabaId, accessToken, templateName);
    } catch {
      /* template metadata optional for component building */
    }

    for (const recipient of recipients) {
        const live = await prisma.campaign.findUnique({
        where: { id: campaignId },
          select: { status: true, runVersion: true },
      });
        if (!live || live.status !== 'RUNNING' || live.runVersion !== runVersion) break;

      const contact = await prisma.contact.findUnique({
        where: {
          organizationId_phone: { organizationId, phone: recipient.phone },
        },
        select: {
          optedIn: true, consentSource: true, consentAt: true, consentVersion: true,
          consentDecision: true, optOutAt: true, updatedAt: true,
        },
      });
      if (!contact || !hasAuditableCampaignConsent(contact)) {
        const rejected = await prisma.campaignRecipient.updateMany({
          where: { id: recipient.id, status: 'PENDING', claimToken: null },
          data: {
            status: 'FAILED',
            errorMessage: 'Recipient has no active, auditable campaign consent',
          },
        });
        if (rejected.count === 1) {
          await prisma.campaign.update({
            where: { id: campaignId },
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
          campaign: { status: 'RUNNING', runVersion: campaign.runVersion },
        },
        data: {
          claimToken,
          claimedAt: new Date(),
          consentSnapshot: buildConsentSnapshot({
            phone: recipient.phone,
            business: {
              organizationId,
              name: campaign.organization.companyName,
              businessId: campaign.whatsappNumber?.businessId,
              phoneNumberId: campaign.whatsappNumber?.phoneNumberId,
            },
            category: 'MARKETING',
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

      const mergedParams = mergeTemplateParams(
        templateParams,
        recipient.variables,
        recipient.name
      );
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
          data: { status: 'SENT', metaMessageId, sentAt: new Date(), errorMessage: null },
        });
        if (completed.count === 1) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { sentCount: { increment: 1 } },
          });
        } else {
          // Meta may have accepted the request while pause/cancel committed.
          // Record that ambiguous outcome so lease recovery never retries it.
          await prisma.campaignRecipient.updateMany({
            where: { id: recipient.id, claimToken },
            data: {
              status: 'SENT',
              metaMessageId,
              sentAt: new Date(),
              errorMessage: 'Sent before campaign pause/cancel; reconciled with Meta status',
            },
          });
        }

        emitToOrg(organizationId, 'campaign:progress', {
          campaignId,
          recipientId: recipient.id,
          status: 'SENT',
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Send failed';
        logError(err, {
          source: 'worker',
          queueName: 'broadcast-queue',
          jobId: job.id,
          path: `recipient:${recipient.phone}`,
        });

        const ambiguous = await prisma.campaignRecipient.updateMany({
          where: { id: recipient.id, claimToken },
          data: {
            status: 'AMBIGUOUS',
            errorMessage: `Provider outcome unknown; reconcile with Meta before retrying: ${errorMessage}`,
            claimToken: null,
            claimedAt: null,
          },
        });

        emitToOrg(organizationId, 'campaign:progress', {
          campaignId,
          recipientId: recipient.id,
          status: ambiguous.count === 1 ? 'AMBIGUOUS' : 'FAILED',
          errorMessage,
        });
      }
    }

    const { finalizeCampaignIfDone } = await import('../modules/campaigns/service');
    await finalizeCampaignIfDone(campaignId);
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

if (require.main === module) {
  setupGlobalErrorHandlers();

  checkRedisConnection()
    .then((ok) => {
      if (!ok) {
        log.error(
          `Redis not reachable at ${config.redisUrl}. Start Redis from the repo root: docker compose up -d`
        );
        process.exit(1);
      }
      startWorkers();
    })
    .catch((err) => {
      logError(err, { source: 'startup', path: 'workers.main' });
      process.exit(1);
    });
}
