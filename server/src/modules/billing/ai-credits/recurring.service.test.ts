import { beforeEach, describe, expect, it, vi } from 'vitest';

const { grantTopUp } = vi.hoisted(() => ({
  grantTopUp: vi.fn(),
}));

vi.mock('./service', () => ({
  grantTopUp,
}));

vi.mock('../../../config/database', () => ({
  default: {
    aiCreditPurchase: {
      findUnique: vi.fn(),
    },
    orgAiRecurringAddon: {
      updateMany: vi.fn(),
    },
  },
}));

import prisma from '../../../config/database';
import { grantRecurringAddonCharge } from './recurring.service';

const purchaseFindUnique = vi.mocked(prisma.aiCreditPurchase.findUnique);
const recurringUpdateMany = vi.mocked(prisma.orgAiRecurringAddon.updateMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recurring addon grants', () => {
  it('recurring-charge-grant-ok: grants credits on first subscription charge', async () => {
    purchaseFindUnique.mockResolvedValue(null);
    grantTopUp.mockResolvedValue({ creditsGranted: 5000, addonBalance: 5000 });
    recurringUpdateMany.mockResolvedValue({ count: 1 });

    const result = await grantRecurringAddonCharge({
      organizationId: 'org-1',
      skuId: 'ai_chat_addon_monthly_5k',
      razorpayPaymentId: 'pay_sub_1',
      razorpaySubscriptionId: 'sub_1',
      currentPeriodEnd: new Date('2026-09-25T00:00:00.000Z'),
    });

    expect(result.alreadyGranted).toBe(false);
    expect(result.creditsGranted).toBe(5000);
    expect(grantTopUp).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        razorpayPaymentId: 'pay_sub_1',
        razorpaySubscriptionId: 'sub_1',
      })
    );
  });

  it('recurring-charge-grant-ok: skips duplicate payment id', async () => {
    purchaseFindUnique.mockResolvedValue({
      id: 'purchase-1',
      creditsGranted: 5000,
    } as never);

    const result = await grantRecurringAddonCharge({
      organizationId: 'org-1',
      skuId: 'ai_chat_addon_monthly_5k',
      razorpayPaymentId: 'pay_sub_1',
    });

    expect(result.alreadyGranted).toBe(true);
    expect(grantTopUp).not.toHaveBeenCalled();
  });
});
