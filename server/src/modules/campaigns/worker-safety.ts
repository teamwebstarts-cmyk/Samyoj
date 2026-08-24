import type { CampaignStatus } from '@prisma/client';

export interface BroadcastJobContext {
  campaignId: string;
  organizationId: string;
  whatsappNumberDbId: string;
  phoneNumberId: string;
  wabaId?: string | null;
  runVersion: number;
}

export interface LiveBroadcastContext {
  id: string;
  organizationId: string;
  whatsappNumberId: string | null;
  status: string;
  runVersion: number;
  whatsappNumber?: {
    phoneNumberId: string;
    wabaId: string | null;
  } | null;
}

export function isBroadcastJobContextValid(
  job: BroadcastJobContext,
  live: LiveBroadcastContext | null | undefined
) {
  return Boolean(
    live &&
      live.id === job.campaignId &&
      live.status === 'RUNNING' &&
      live.runVersion === job.runVersion &&
      live.organizationId === job.organizationId &&
      live.whatsappNumberId === job.whatsappNumberDbId &&
      live.whatsappNumber?.phoneNumberId === job.phoneNumberId &&
      (!job.wabaId || live.whatsappNumber.wabaId === job.wabaId)
  );
}

export function canRollbackQueuedCampaign(input: {
  status: string;
  runVersion: number;
  expectedRunVersion: number;
}) {
  return input.status === 'RUNNING' && input.runVersion === input.expectedRunVersion;
}

export function canClaimManualCampaignRun(input: {
  status: string;
  runVersion: number;
  expectedRunVersion: number;
}) {
  return (
    (input.status === 'DRAFT' || input.status === 'SCHEDULED') &&
    input.runVersion === input.expectedRunVersion
  );
}

export function manualCampaignRunClaimWhere(campaignId: string, expectedRunVersion: number) {
  return {
    id: campaignId,
    status: { in: ['DRAFT', 'SCHEDULED'] as CampaignStatus[] },
    runVersion: expectedRunVersion,
  };
}

export function materializedCampaignRunVersion(runVersion: number, bumpRunVersion: boolean) {
  return runVersion + (bumpRunVersion ? 1 : 0);
}

/** BullMQ rejects custom job IDs containing ":" (and some other chars). */
const BULLMQ_JOB_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function isValidBullMqJobId(jobId: string) {
  return jobId.length > 0 && jobId.length <= 128 && BULLMQ_JOB_ID_PATTERN.test(jobId);
}

export function buildCampaignJobId(
  campaignId: string,
  runVersion: number,
  kind: 'batch' | 'retry',
  firstRecipientId: string
) {
  const jobId = `campaign__${campaignId}__run__${runVersion}__${kind}__${firstRecipientId}`;
  if (!isValidBullMqJobId(jobId)) {
    throw new Error(`Invalid BullMQ job id: ${jobId}`);
  }
  return jobId;
}

export function campaignJobClaimPrefix(jobId: string | number) {
  return `${String(jobId)}:`;
}
