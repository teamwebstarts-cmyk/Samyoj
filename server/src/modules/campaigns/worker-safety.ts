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

export function buildCampaignJobId(
  campaignId: string,
  runVersion: number,
  kind: 'batch' | 'retry',
  firstRecipientId: string
) {
  return `campaign:${campaignId}:run:${runVersion}:${kind}:${firstRecipientId}`;
}

export function campaignJobClaimPrefix(jobId: string | number) {
  return `${String(jobId)}:`;
}
