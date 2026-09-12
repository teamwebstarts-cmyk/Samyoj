import prisma from '../../config/database';
import { PLAN_TIERS, BILLING_SKUS, PlanTier, PlanTierDef, BillingSkuDef } from './plans';
import { z } from 'zod';

const skuSchema = z.object({
  id: z.string().regex(/^(launch_trial|(starter|growth|pro)_(monthly|quarterly|yearly))$/),
  planTier: z.enum(['launch', 'starter', 'growth', 'pro']),
  cadence: z.enum(['trial', 'monthly', 'quarterly', 'yearly']),
  pricePaise: z.number().int().nonnegative(),
  inclGstPaise: z.number().int().nonnegative(),
  periodDays: z.number().int().positive(),
  name: z.string().min(1),
  cadenceLabel: z.string().min(1),
  effectiveMonthlyLabel: z.string().min(1),
  invoiceLabel: z.string().min(1),
  upiAutopayAllowed: z.boolean(),
}).passthrough();

const tierSchema = z.object({
  tier: z.enum(['launch', 'starter', 'growth', 'pro', 'enterprise']),
  name: z.string().min(1),
  seats: z.union([z.number().int().positive(), z.literal('custom')]),
  contacts: z.union([z.number().int().positive(), z.literal('unlimited')]),
  publishedWorkflows: z.union([z.number().int().positive(), z.literal('unlimited')]),
  aiIncluded: z.enum(['off', 'included', 'advanced', 'dedicated']),
}).passthrough();

export const billingConfigSchema = z.object({
  planTiers: z.record(tierSchema),
  billingSkus: z.array(skuSchema).min(1),
});

export function parseBillingConfig(value: unknown): {
  planTiers: Record<string, PlanTierDef>;
  billingSkus: BillingSkuDef[];
} {
  return billingConfigSchema.parse(value) as unknown as {
    planTiers: Record<string, PlanTierDef>;
    billingSkus: BillingSkuDef[];
  };
}

export async function refreshBillingConfig() {
  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { key: 'BILLING_CONFIG' },
    });
    if (setting && setting.value) {
      const data = parseBillingConfig(setting.value);
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
