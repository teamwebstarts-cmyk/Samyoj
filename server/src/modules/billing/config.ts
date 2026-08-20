import prisma from '../../config/database';
import { PLAN_TIERS, BILLING_SKUS, PlanTier, PlanTierDef, BillingSkuDef } from './plans';

export async function refreshBillingConfig() {
  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { key: 'BILLING_CONFIG' },
    });
    if (setting && setting.value) {
      const data = setting.value as { planTiers?: Record<PlanTier, PlanTierDef>; billingSkus?: BillingSkuDef[] };
      if (data.planTiers) {
        Object.keys(PLAN_TIERS).forEach(k => delete PLAN_TIERS[k as PlanTier]);
        Object.assign(PLAN_TIERS, data.planTiers);
      }
      if (data.billingSkus) {
        BILLING_SKUS.length = 0;
        BILLING_SKUS.push(...data.billingSkus);
      }
    }
  } catch (error) {
    console.error('Failed to refresh billing config', error);
  }
}
