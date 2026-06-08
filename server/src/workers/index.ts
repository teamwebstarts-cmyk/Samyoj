import { Worker, Job } from 'bullmq';
import { Server } from 'socket.io';
import prisma from '../config/database';
import { config } from '../config';
import { MetaWhatsAppService } from '../modules/whatsapp/meta.service';
import { deliverOutboundMessage } from '../modules/messages/send.service';
import { retryDelays } from '../config/queues';
import { processWebhookFields } from '../modules/calling/call.processor';
import { processAiChatbotJob } from '../modules/automation/engine';
import { attachWorkerErrorHandlers, logError, setupGlobalErrorHandlers } from '../errors';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('worker');

const connection = { url: config.redisUrl };

let io: Server | null = null;

export function setSocketIO(socketServer: Server) {
  io = socketServer;
}

function getRetryDelay(attemptsMade: number): number {
  return retryDelays[Math.min(attemptsMade, retryDelays.length - 1)];
}

setupGlobalErrorHandlers();

// Webhook worker
const webhookWorker = new Worker(
  'webhook-queue',
  async (job: Job) => {
    await processWebhookFields(job.data.payload);
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
      buttons,
      mediaUrl,
      mediaCaption,
    } = job.data;

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
      buttons,
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
    } = job.data;

    if (!phoneNumberId || !encryptedToken) {
      throw new Error('Campaign job missing WhatsApp credentials. Re-send the campaign from the UI.');
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });
    if (!campaign || !['RUNNING'].includes(campaign.status)) {
      return;
    }

    const accessToken = MetaWhatsAppService.decryptToken(encryptedToken);
    if (wabaId) {
      await MetaWhatsAppService.ensureWabaSubscribed(wabaId, accessToken);
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
        select: { status: true },
      });
      if (!live || live.status !== 'RUNNING') break;

      const contact = await prisma.contact.findUnique({
        where: {
          organizationId_phone: { organizationId, phone: recipient.phone },
        },
        select: { optedIn: true },
      });
      if (contact && !contact.optedIn) {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Contact has not opted in',
          },
        });
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        });
        continue;
      }

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

        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'SENT', metaMessageId, sentAt: new Date(), errorMessage: null },
        });

        await prisma.campaign.update({
          where: { id: campaignId },
          data: { sentCount: { increment: 1 } },
        });

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

        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'FAILED', errorMessage },
        });

        await prisma.campaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        });

        emitToOrg(organizationId, 'campaign:progress', {
          campaignId,
          recipientId: recipient.id,
          status: 'FAILED',
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

log.info('Workers started', {
  queues: ['webhook-queue', 'message-queue', 'broadcast-queue', 'automation-queue', 'flow-queue'],
});

// Scheduled campaign processor (every minute)
setInterval(() => {
  import('../modules/campaigns/service')
    .then(({ processScheduledCampaigns }) => processScheduledCampaigns())
    .catch((err) => logError(err, { source: 'worker', action: 'processScheduledCampaigns' }));
}, 60_000);
