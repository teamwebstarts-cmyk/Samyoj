import { describe, expect, it } from 'vitest';
import {
  buildCampaignJobId,
  canClaimManualCampaignRun,
  canRollbackQueuedCampaign,
  isBroadcastJobContextValid,
  manualCampaignRunClaimWhere,
  materializedCampaignRunVersion,
} from './worker-safety';

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
    expect(buildCampaignJobId('campaign-1', 7, 'batch', 'recipient-1'))
      .toBe('campaign:campaign-1:run:7:batch:recipient-1');
  });
});
