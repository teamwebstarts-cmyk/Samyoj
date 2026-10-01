import { describe, expect, it } from 'vitest';
import {
  buildCampaignJobId,
  canClaimManualCampaignRun,
  canRollbackQueuedCampaign,
  isBroadcastJobContextValid,
  isValidBullMqJobId,
  manualCampaignRunClaimWhere,
  materializedCampaignRunVersion,
} from './worker-safety';
import { gmailSendJobId } from '../gmail/constants';
import { flowDelayJobId, inboundLockRetryJobId } from '../flows/inbound-wait';

const job = {
  campaignId: 'campaign-1',
  organizationId: 'org-1',
  whatsappNumberDbId: 'number-1',
  phoneNumberId: 'phone-1',
  wabaId: 'waba-1',
  runVersion: 7,
};

const live = {
  id: 'campaign-1',
  organizationId: 'org-1',
  whatsappNumberId: 'number-1',
  status: 'RUNNING',
  runVersion: 7,
  whatsappNumber: { phoneNumberId: 'phone-1', wabaId: 'waba-1' },
};

describe('campaign worker safety', () => {
  it('validates broadcast organization, number, WABA, and run fences', () => {
    expect(isBroadcastJobContextValid(job, live)).toBe(true);
    expect(isBroadcastJobContextValid({ ...job, organizationId: 'other-org' }, live)).toBe(false);
    expect(isBroadcastJobContextValid({ ...job, phoneNumberId: 'other-phone' }, live)).toBe(false);
    expect(isBroadcastJobContextValid({ ...job, wabaId: 'other-waba' }, live)).toBe(false);
    expect(isBroadcastJobContextValid({ ...job, runVersion: 6 }, live)).toBe(false);
    expect(isBroadcastJobContextValid(job, { ...live, runVersion: 8 })).toBe(false);
  });

  it('only rolls back the run that still owns the queued campaign', () => {
    expect(canRollbackQueuedCampaign({
      status: 'RUNNING',
      runVersion: 7,
      expectedRunVersion: 7,
    })).toBe(true);
    expect(canRollbackQueuedCampaign({
      status: 'RUNNING',
      runVersion: 8,
      expectedRunVersion: 7,
    })).toBe(false);
    expect(canRollbackQueuedCampaign({
      status: 'PAUSED',
      runVersion: 7,
      expectedRunVersion: 7,
    })).toBe(false);
  });

  it('rejects manual sends from stale draft or scheduled campaign snapshots', () => {
    expect(canClaimManualCampaignRun({ status: 'DRAFT', runVersion: 7, expectedRunVersion: 7 })).toBe(true);
    expect(canClaimManualCampaignRun({ status: 'SCHEDULED', runVersion: 7, expectedRunVersion: 7 })).toBe(true);
    expect(canClaimManualCampaignRun({ status: 'DRAFT', runVersion: 6, expectedRunVersion: 7 })).toBe(false);
    expect(canClaimManualCampaignRun({ status: 'RUNNING', runVersion: 7, expectedRunVersion: 7 })).toBe(false);
    expect(manualCampaignRunClaimWhere('campaign-1', 7)).toEqual({
      id: 'campaign-1',
      status: { in: ['DRAFT', 'SCHEDULED'] },
      runVersion: 7,
    });
    expect(materializedCampaignRunVersion(7, true)).toBe(8);
    expect(materializedCampaignRunVersion(7, false)).toBe(7);
  });

  it('fences deterministic jobs by run so stale jobs cannot collide', () => {
    expect(buildCampaignJobId('campaign-1', 7, 'retry', 'recipient-1'))
      .not.toBe(buildCampaignJobId('campaign-1', 8, 'retry', 'recipient-1'));
    const jobId = buildCampaignJobId('campaign-1', 7, 'batch', 'recipient-1');
    expect(jobId).toBe('campaign__campaign-1__run__7__batch__recipient-1');
    expect(jobId).not.toContain(':');
    expect(isValidBullMqJobId(jobId)).toBe(true);
  });

  it('builds BullMQ-safe job ids for real UUID campaign and recipient ids', () => {
    const campaignId = 'b69832e8-eea6-47ca-99d9-96f8c0aecd3c';
    const recipientId = '0272f8ed-2425-4e35-91c9-f993a94f4177';
    const jobId = buildCampaignJobId(campaignId, 3, 'batch', recipientId);
    expect(isValidBullMqJobId(jobId)).toBe(true);
    expect(jobId).not.toContain(':');
  });

  it('keeps Gmail and flow job ids inside the BullMQ alphabet', () => {
    const gmailId = gmailSendJobId('27b7daa5-6cff-4143-84e4-a82598871bbc');
    const delayId = flowDelayJobId('conv-1');
    const retryId = inboundLockRetryJobId('conv-1', 'msg-1');
    for (const jobId of [gmailId, delayId, retryId]) {
      expect(isValidBullMqJobId(jobId)).toBe(true);
      expect(jobId).not.toContain(':');
    }
  });
});
