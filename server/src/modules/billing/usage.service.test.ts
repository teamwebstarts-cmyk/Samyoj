import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    conversationCharge: { findMany: vi.fn() },
    whatsappNumber: { findMany: vi.fn() },
    message: { findMany: vi.fn() },
    organization: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../whatsapp/meta.service', () => ({
  MetaWhatsAppService: {
    decryptToken: vi.fn(),
    getConversationAnalytics: vi.fn(),
    getPhoneNumberQuality: vi.fn(),
    syncWhatsappConnection: vi.fn(),
    listMessageTemplates: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  createModuleLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../platform/events', () => ({
  emitProductEvent: vi.fn(),
}));

import prisma from '../../config/database';
import { estimateCampaignCost, getOrgUsage } from './usage.service';

const chargeFindMany = vi.mocked(prisma.conversationCharge.findMany);
const numberFindMany = vi.mocked(prisma.whatsappNumber.findMany);
const messageFindMany = vi.mocked(prisma.message.findMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('estimateCampaignCost', () => {
  it('calculates MARKETING rate (₹0.78 per recipient)', () => {
    const result = estimateCampaignCost(1000, 'MARKETING');
    expect(result.recipientCount).toBe(1000);
    expect(result.category).toBe('MARKETING');
    expect(result.estimatedCostInr).toBe(780);
  });

  it('calculates UTILITY rate (₹0.35 per recipient)', () => {
    const result = estimateCampaignCost(100, 'UTILITY');
    expect(result.estimatedCostInr).toBe(35);
  });

  it('calculates AUTHENTICATION rate (₹0.35 per recipient)', () => {
    const result = estimateCampaignCost(100, 'AUTHENTICATION');
    expect(result.estimatedCostInr).toBe(35);
  });

  it('calculates SERVICE rate (₹0)', () => {
    const result = estimateCampaignCost(500, 'SERVICE');
    expect(result.estimatedCostInr).toBe(0);
  });

  it('calculates USER_INITIATED rate (₹0)', () => {
    const result = estimateCampaignCost(500, 'USER_INITIATED');
    expect(result.estimatedCostInr).toBe(0);
  });

  it('calculates BUSINESS_INITIATED rate (₹0.35 per recipient)', () => {
    const result = estimateCampaignCost(200, 'BUSINESS_INITIATED');
    expect(result.estimatedCostInr).toBe(70);
    expect(result.category).toBe('BUSINESS_INITIATED');
  });

  it('defaults to MARKETING when no category is given', () => {
    const result = estimateCampaignCost(100);
    expect(result.category).toBe('MARKETING');
    expect(result.estimatedCostInr).toBe(78);
  });

  it('falls back to MARKETING rate for unknown categories', () => {
    const result = estimateCampaignCost(100, 'UNKNOWN');
    expect(result.category).toBe('UNKNOWN');
    expect(result.estimatedCostInr).toBe(78);
  });

  it('uppercases the category', () => {
    const result = estimateCampaignCost(10, 'marketing');
    expect(result.category).toBe('MARKETING');
  });

  it('rounds cost to two decimal places', () => {
    // 3 * 0.78 = 2.34 (exact)
    const result = estimateCampaignCost(3, 'MARKETING');
    expect(result.estimatedCostInr).toBe(2.34);
  });

  it('handles zero recipients', () => {
    const result = estimateCampaignCost(0, 'MARKETING');
    expect(result.estimatedCostInr).toBe(0);
    expect(result.recipientCount).toBe(0);
  });
});

describe('getOrgUsage', () => {
  it('returns aggregated usage data from Prisma', async () => {
    chargeFindMany.mockResolvedValue([
      { category: 'MARKETING', conversationCount: 10, costInr: 7.8 },
      { category: 'MARKETING', conversationCount: 5, costInr: 3.9 },
      { category: 'UTILITY', conversationCount: 20, costInr: 7 },
    ] as never);

    numberFindMany.mockResolvedValue([
      { phoneNumber: '+919999900001', qualityRating: 'GREEN', wabaId: 'w1' },
    ] as never);

    messageFindMany.mockResolvedValue([
      { metadata: { pricing: { category: 'MARKETING' } } },
      { metadata: null },
      { metadata: { pricing: { category: 'UTILITY' } } },
    ] as never);

    const result = await getOrgUsage('org-1');

    expect(result.period).toBe('30d');
    expect(result.totalConversations).toBe(35);
    expect(result.totalCostInr).toBe(18.7);
    expect(result.byCategory.MARKETING.count).toBe(15);
    expect(result.byCategory.MARKETING.costInr).toBeCloseTo(11.7);
    expect(result.byCategory.UTILITY.count).toBe(20);
    expect(result.byCategory.UTILITY.costInr).toBe(7);
    expect(result.qualityRatings).toEqual([
      { phoneNumber: '+919999900001', qualityRating: 'GREEN', wabaId: 'w1' },
    ]);
    expect(result.messagesWithPricing).toBe(2);
  });

  it('defaults qualityRating to UNKNOWN when null', async () => {
    chargeFindMany.mockResolvedValue([] as never);
    numberFindMany.mockResolvedValue([
      { phoneNumber: '+919999900002', qualityRating: null, wabaId: 'w2' },
    ] as never);
    messageFindMany.mockResolvedValue([] as never);

    const result = await getOrgUsage('org-1');
    expect(result.qualityRatings[0].qualityRating).toBe('UNKNOWN');
  });

  it('handles zero charges gracefully', async () => {
    chargeFindMany.mockResolvedValue([] as never);
    numberFindMany.mockResolvedValue([] as never);
    messageFindMany.mockResolvedValue([] as never);

    const result = await getOrgUsage('org-1');
    expect(result.totalConversations).toBe(0);
    expect(result.totalCostInr).toBe(0);
    expect(result.byCategory).toEqual({});
    expect(result.qualityRatings).toEqual([]);
    expect(result.messagesWithPricing).toBe(0);
  });

  it('queries Prisma with organizationId and 30-day window', async () => {
    chargeFindMany.mockResolvedValue([] as never);
    numberFindMany.mockResolvedValue([] as never);
    messageFindMany.mockResolvedValue([] as never);

    await getOrgUsage('org-42');

    expect(chargeFindMany).toHaveBeenCalledTimes(1);
    const chargeArgs = chargeFindMany.mock.calls[0]?.[0] as {
      where?: { organizationId?: string; periodStart?: { gte?: Date } };
    };
    expect(chargeArgs?.where?.organizationId).toBe('org-42');
    expect(chargeArgs?.where?.periodStart?.gte).toBeInstanceOf(Date);

    expect(numberFindMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-42', isActive: true },
      select: { phoneNumber: true, qualityRating: true, wabaId: true },
    });
  });

  it('returns multiple quality ratings for multiple numbers', async () => {
    chargeFindMany.mockResolvedValue([] as never);
    numberFindMany.mockResolvedValue([
      { phoneNumber: '+919999900001', qualityRating: 'GREEN', wabaId: 'w1' },
      { phoneNumber: '+919999900002', qualityRating: 'YELLOW', wabaId: 'w1' },
      { phoneNumber: '+919999900003', qualityRating: null, wabaId: 'w2' },
    ] as never);
    messageFindMany.mockResolvedValue([] as never);

    const result = await getOrgUsage('org-1');
    expect(result.qualityRatings).toHaveLength(3);
    expect(result.qualityRatings[2].qualityRating).toBe('UNKNOWN');
  });
});
