import { describe, expect, it } from 'vitest';
import {
  canRollbackQueuedCampaign,
  isBroadcastJobContextValid,
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
});
