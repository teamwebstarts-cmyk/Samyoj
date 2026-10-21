import { Queue } from 'bullmq';
import { config } from '../config';

const connection = { url: config.redisUrl };

export const defaultJobOptions = {
  attempts: 4,
  backoff: {
    type: 'custom' as const,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
};

// Webhook queue: bounded retries with a capped failed-set so a poison payload
// cannot sit in Redis forever. The matching backoffStrategy lives on the worker.
export const webhookQueueDefaultJobOptions = {
  attempts: 5,
  backoff: { type: 'custom' as const },
  removeOnComplete: 500,
  removeOnFail: 200,
};

export const webhookQueue = new Queue('webhook-queue', {
  connection,
  defaultJobOptions: webhookQueueDefaultJobOptions,
});
export const messageQueue = new Queue('message-queue', { connection });
export const broadcastQueue = new Queue('broadcast-queue', { connection, defaultJobOptions });
export const automationQueue = new Queue('automation-queue', { connection });
// Flow continuations are durable work, not fire-and-forget timers. Individual
// lock-retry jobs override this with one attempt because they reschedule
// themselves explicitly.
export const flowQueue = new Queue('flow-queue', { connection, defaultJobOptions });
export const retryQueue = new Queue('retry-queue', { connection });
export const notificationQueue = new Queue('notification-queue', { connection });
export const webhookDispatchQueue = new Queue('webhook-dispatch', { connection });
export const compliancePurgeQueue = new Queue('compliance-purge', { connection });
export const contentQueue = new Queue('content', { connection });
export const contentImageQueue = new Queue('content-image', { connection });
export const contentVideoQueue = new Queue('content-video', { connection });
export const gmailSendQueue = new Queue('gmail-send', {
  connection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 4 },
});

export const retryDelays = [10000, 30000, 120000, 600000]; // 10s, 30s, 2m, 10m
