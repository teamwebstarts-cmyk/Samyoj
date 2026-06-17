import { Queue } from 'bullmq';
import { config } from '../config';

const connection = { url: config.redisUrl };

export const webhookQueue = new Queue('webhook-queue', { connection });
export const messageQueue = new Queue('message-queue', { connection });
export const broadcastQueue = new Queue('broadcast-queue', { connection });
export const automationQueue = new Queue('automation-queue', { connection });
export const flowQueue = new Queue('flow-queue', { connection });
export const retryQueue = new Queue('retry-queue', { connection });
export const notificationQueue = new Queue('notification-queue', { connection });
export const webhookDispatchQueue = new Queue('webhook-dispatch', { connection });
export const compliancePurgeQueue = new Queue('compliance-purge', { connection });
export const contentQueue = new Queue('content', { connection });
export const contentImageQueue = new Queue('content-image', { connection });
export const contentVideoQueue = new Queue('content-video', { connection });

export const defaultJobOptions = {
  attempts: 4,
  backoff: {
    type: 'custom' as const,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
};

export const retryDelays = [10000, 30000, 120000, 600000]; // 10s, 30s, 2m, 10m
