import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../config/database';
import {
  checkQuota,
  getBoundedSeatLimit,
  getOrgEntitlements,
  isTierSufficient,
} from './entitlements.service';

vi.mock('../../config/database', () => ({
  default: {
    organization: {
      findUnique: vi.fn(),
    },
    whatsappNumber: {
      count: vi.fn(),
    },
    organizationUser: {
      count: vi.fn(),
    },
    teamInvite: {
      count: vi.fn(),
    },
    contact: {
      count: vi.fn(),
    },
    automation: {
      count: vi.fn(),
    },
  },
}));

describe('entitlements.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isTierSufficient', () => {
    it('correctly ranks tiers', () => {
      expect(isTierSufficient('growth', 'starter')).toBe(true);
      expect(isTierSufficient('growth', 'growth')).toBe(true);
      expect(isTierSufficient('starter', 'growth')).toBe(false);
      expect(isTierSufficient('launch', 'starter')).toBe(false);
      expect(isTierSufficient('pro', 'growth')).toBe(true);
      expect(isTierSufficient('enterprise', 'pro')).toBe(true);
    });
  });

  describe('getBoundedSeatLimit', () => {
    it('returns exact plan limits for standard tiers', () => {
      expect(getBoundedSeatLimit('launch')).toBe(1);
      expect(getBoundedSeatLimit('starter')).toBe(3);
      expect(getBoundedSeatLimit('growth')).toBe(10);
      expect(getBoundedSeatLimit('pro')).toBe(25);
    });

    it('returns custom limit for enterprise tier', () => {
      expect(getBoundedSeatLimit('enterprise', 50)).toBe(50);
      expect(getBoundedSeatLimit('enterprise')).toBe(999);
    });
  });

  describe('getOrgEntitlements & checkQuota', () => {
    it('enforces launch tier quotas', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-1',
        plan: 'launch',
        subscriptionStatus: 'trial',
        planExpiresAt: new Date(Date.now() + 7 * 86400000),
      } as never);
      vi.mocked(prisma.whatsappNumber.count).mockResolvedValue(1);
      vi.mocked(prisma.organizationUser.count).mockResolvedValue(1);
      vi.mocked(prisma.teamInvite.count).mockResolvedValue(0);
      vi.mocked(prisma.contact.count).mockResolvedValue(90);
      vi.mocked(prisma.automation.count).mockResolvedValue(1);

      const ent = await getOrgEntitlements('org-1');
      expect(ent.planTier).toBe('launch');
      expect(ent.quotas.waNumbers.limit).toBe(1);
      expect(ent.quotas.seats.limit).toBe(1);
      expect(ent.quotas.contacts.limit).toBe(100);
      expect(ent.quotas.publishedWorkflows.limit).toBe(1);
      expect(ent.quotas.aiIncluded).toBe('off');
      expect(ent.quotas.callingIncluded).toBe(false);

      // Checking extra number should be blocked
      const waCheck = await checkQuota('org-1', 'waNumbers', 1);
      expect(waCheck.allowed).toBe(false);
      expect(waCheck.code).toBe('PLAN_LIMIT_WA_NUMBERS');

      // AI should be blocked
      const aiCheck = await checkQuota('org-1', 'ai');
      expect(aiCheck.allowed).toBe(false);
      expect(aiCheck.code).toBe('PLAN_FEATURE_AI');
    });

    it('allows growth tier features and quotas', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-2',
        plan: 'growth',
        subscriptionStatus: 'active',
        planExpiresAt: null,
      } as never);
      vi.mocked(prisma.whatsappNumber.count).mockResolvedValue(1);
      vi.mocked(prisma.organizationUser.count).mockResolvedValue(3);
      vi.mocked(prisma.teamInvite.count).mockResolvedValue(1);
      vi.mocked(prisma.contact.count).mockResolvedValue(5000);
      vi.mocked(prisma.automation.count).mockResolvedValue(8);

      const waCheck = await checkQuota('org-2', 'waNumbers', 1);
      expect(waCheck.allowed).toBe(true);

      const aiCheck = await checkQuota('org-2', 'ai');
      expect(aiCheck.allowed).toBe(true);

      const workflowCheck = await checkQuota('org-2', 'publishedWorkflows', 5);
      expect(workflowCheck.allowed).toBe(true);
      expect(workflowCheck.limit).toBe('unlimited');
    });

    it('blocks actions when subscription is locked or expired', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-3',
        plan: 'growth',
        subscriptionStatus: 'trial_expired',
        planExpiresAt: new Date(Date.now() - 86400000),
      } as never);
      vi.mocked(prisma.whatsappNumber.count).mockResolvedValue(1);
      vi.mocked(prisma.organizationUser.count).mockResolvedValue(2);
      vi.mocked(prisma.teamInvite.count).mockResolvedValue(0);
      vi.mocked(prisma.contact.count).mockResolvedValue(100);
      vi.mocked(prisma.automation.count).mockResolvedValue(0);

      const ent = await getOrgEntitlements('org-3');
      expect(ent.isLocked).toBe(true);

      const check = await checkQuota('org-3', 'contacts', 1);
      expect(check.allowed).toBe(false);
      expect(check.code).toBe('SUBSCRIPTION_LOCKED');
    });
  });
});
