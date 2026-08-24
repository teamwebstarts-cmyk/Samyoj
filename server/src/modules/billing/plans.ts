export type PlanTier = 'launch' | 'starter' | 'growth' | 'pro' | 'enterprise';
export type Cadence = 'trial' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

export const GST_RATE = 0.18; // 18% — update here only, never hardcode elsewhere

export interface BillingSkuDef {
  id: string;           // e.g. 'growth_quarterly'
  planTier: PlanTier;
  cadence: Cadence;
  name: string;         // display name e.g. 'Growth'
  cadenceLabel: string; // e.g. 'quarterly'
  /** Paise, exclusive of GST */
  pricePaise: number;
  /** Paise, inclusive of 18% GST — pre-computed to avoid float errors */
  inclGstPaise: number;
  /** Nominal period days (30 / 90 / 365 / 14) */
  periodDays: number;
  /** Effective monthly price label for display */
  effectiveMonthlyLabel: string;
  /** Invoice label */
  invoiceLabel: string;
  /** True = offer UPI Autopay; false = card/eNACH only */
  upiAutopayAllowed: boolean;
  isMostPopular?: boolean;
}

export interface PlanTierDef {
  tier: PlanTier;
  name: string;
  waNumbers: number | 'unlimited';
  seats: number | 'custom';
  contacts: number | 'unlimited';
  publishedWorkflows: number | 'unlimited';
  aiIncluded: 'off' | 'included' | 'advanced' | 'dedicated';
  callingIncluded: boolean;
  chatCreditsIncluded: number;
  callingMinutesIncluded: number;
  analyticsAdvanced: boolean;
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
  features: string[];
}

export const PLAN_TIERS: Record<PlanTier, PlanTierDef> = {
  launch: {
    tier: 'launch',
    name: 'Kickstart',
    waNumbers: 1,
    seats: 1,
    contacts: 100,
    publishedWorkflows: 1,
    aiIncluded: 'off',
    callingIncluded: false,
    chatCreditsIncluded: 0,
    callingMinutesIncluded: 0,
    analyticsAdvanced: false,
    supportLevel: 'community',
    features: ['1 WhatsApp number', '1 team member', '100 contacts', '1 workflow', 'Shared inbox', 'Basic analytics'],
  },
  starter: {
    tier: 'starter',
    name: 'Starter',
    waNumbers: 1,
    seats: 3,
    contacts: 5000,
    publishedWorkflows: 5,
    aiIncluded: 'off',
    callingIncluded: false,
    chatCreditsIncluded: 0,
    callingMinutesIncluded: 0,
    analyticsAdvanced: false,
    supportLevel: 'email',
    features: ['1 WhatsApp number', '3 team members', '5,000 contacts', '5 workflows', 'Shared inbox', 'Canned replies', 'Email support'],
  },
  growth: {
    tier: 'growth',
    name: 'Growth',
    waNumbers: 2,
    seats: 10,
    contacts: 25000,
    publishedWorkflows: 'unlimited',
    aiIncluded: 'included',
    callingIncluded: false,
    chatCreditsIncluded: 5_000,
    callingMinutesIncluded: 0,
    analyticsAdvanced: true,
    supportLevel: 'priority',
    features: ['2 WhatsApp numbers', '10 team members', '25,000 contacts', 'Unlimited workflows', '5,000 AI chat credits / month', 'AI assistant included', 'Advanced analytics', 'Priority support', 'Advanced integrations'],
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    waNumbers: 5,
    seats: 25,
    contacts: 100000,
    publishedWorkflows: 'unlimited',
    aiIncluded: 'advanced',
    callingIncluded: true,
    chatCreditsIncluded: 25_000,
    callingMinutesIncluded: 120,
    analyticsAdvanced: true,
    supportLevel: 'priority',
    features: ['5 WhatsApp numbers', '25 team members', '100,000 contacts', 'Unlimited workflows', '25,000 AI chat credits / month', '120 AI calling minutes / month', 'Advanced AI', 'Calling module', 'Advanced analytics', 'Priority support'],
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    waNumbers: 'unlimited',
    seats: 'custom',
    contacts: 'unlimited',
    publishedWorkflows: 'unlimited',
    aiIncluded: 'dedicated',
    callingIncluded: true,
    chatCreditsIncluded: 0,
    callingMinutesIncluded: 0,
    analyticsAdvanced: true,
    supportLevel: 'dedicated',
    features: ['Unlimited WhatsApp numbers', 'Custom team size', 'Unlimited contacts', 'Unlimited workflows', 'Custom AI credits', 'Dedicated AI', 'Calling module', 'Custom analytics', 'Dedicated support'],
  },
};

// UPI Autopay AFA-free cap: ₹15,000 incl. GST per RBI e-mandate for generic SaaS MCC
const UPI_CAP_PAISE = 1_500_000;

function inclGst(exclPaise: number): number {
  return Math.round(exclPaise * (1 + GST_RATE));
}

function upiOk(exclPaise: number): boolean {
  return inclGst(exclPaise) <= UPI_CAP_PAISE;
}

export const BILLING_SKUS: BillingSkuDef[] = [
  // Launch trial — free, 14 days
  {
    id: 'launch_trial',
    planTier: 'launch',
    cadence: 'trial',
    name: 'Kickstart',
    cadenceLabel: 'trial',
    pricePaise: 0,
    inclGstPaise: 0,
    periodDays: 14,
    effectiveMonthlyLabel: '₹0',
    invoiceLabel: 'Kickstart — 14-day free trial',
    upiAutopayAllowed: false,
  },
  // Starter
  {
    id: 'starter_monthly',
    planTier: 'starter',
    cadence: 'monthly',
    name: 'Starter',
    cadenceLabel: 'monthly',
    pricePaise: 99_900,
    inclGstPaise: inclGst(99_900),
    periodDays: 30,
    effectiveMonthlyLabel: '₹999/mo',
    invoiceLabel: 'Starter — monthly subscription',
    upiAutopayAllowed: upiOk(99_900),
  },
  {
    id: 'starter_quarterly',
    planTier: 'starter',
    cadence: 'quarterly',
    name: 'Starter',
    cadenceLabel: 'quarterly',
    pricePaise: 285_000,
    inclGstPaise: inclGst(285_000),
    periodDays: 90,
    effectiveMonthlyLabel: '₹950/mo',
    invoiceLabel: 'Starter — quarterly subscription',
    upiAutopayAllowed: upiOk(285_000),
  },
  {
    id: 'starter_yearly',
    planTier: 'starter',
    cadence: 'yearly',
    name: 'Starter',
    cadenceLabel: 'yearly',
    pricePaise: 960_000,
    inclGstPaise: inclGst(960_000),
    periodDays: 365,
    effectiveMonthlyLabel: '₹800/mo',
    invoiceLabel: 'Starter — yearly subscription',
    upiAutopayAllowed: upiOk(960_000),
  },
  // Growth
  {
    id: 'growth_monthly',
    planTier: 'growth',
    cadence: 'monthly',
    name: 'Growth',
    cadenceLabel: 'monthly',
    pricePaise: 249_900,
    inclGstPaise: inclGst(249_900),
    periodDays: 30,
    effectiveMonthlyLabel: '₹2,499/mo',
    invoiceLabel: 'Growth — monthly subscription',
    upiAutopayAllowed: upiOk(249_900),
    isMostPopular: true,
  },
  {
    id: 'growth_quarterly',
    planTier: 'growth',
    cadence: 'quarterly',
    name: 'Growth',
    cadenceLabel: 'quarterly',
    pricePaise: 712_500,
    inclGstPaise: inclGst(712_500),
    periodDays: 90,
    effectiveMonthlyLabel: '₹2,375/mo',
    invoiceLabel: 'Growth — quarterly subscription',
    upiAutopayAllowed: upiOk(712_500),
    isMostPopular: true,
  },
  {
    id: 'growth_yearly',
    planTier: 'growth',
    cadence: 'yearly',
    name: 'Growth',
    cadenceLabel: 'yearly',
    pricePaise: 2_400_000,
    inclGstPaise: inclGst(2_400_000),
    periodDays: 365,
    effectiveMonthlyLabel: '₹2,000/mo',
    invoiceLabel: 'Growth — yearly subscription',
    upiAutopayAllowed: false, // ₹28,320 incl GST > ₹15,000
    isMostPopular: true,
  },
  // Pro
  {
    id: 'pro_monthly',
    planTier: 'pro',
    cadence: 'monthly',
    name: 'Pro',
    cadenceLabel: 'monthly',
    pricePaise: 499_900,
    inclGstPaise: inclGst(499_900),
    periodDays: 30,
    effectiveMonthlyLabel: '₹4,999/mo',
    invoiceLabel: 'Pro — monthly subscription',
    upiAutopayAllowed: upiOk(499_900),
  },
  {
    id: 'pro_quarterly',
    planTier: 'pro',
    cadence: 'quarterly',
    name: 'Pro',
    cadenceLabel: 'quarterly',
    pricePaise: 1_425_000,
    inclGstPaise: inclGst(1_425_000),
    periodDays: 90,
    effectiveMonthlyLabel: '₹4,750/mo',
    invoiceLabel: 'Pro — quarterly subscription',
    upiAutopayAllowed: false, // ₹16,815 incl GST > ₹15,000
  },
  {
    id: 'pro_yearly',
    planTier: 'pro',
    cadence: 'yearly',
    name: 'Pro',
    cadenceLabel: 'yearly',
    pricePaise: 4_800_000,
    inclGstPaise: inclGst(4_800_000),
    periodDays: 365,
    effectiveMonthlyLabel: '₹4,000/mo',
    invoiceLabel: 'Pro — yearly subscription',
    upiAutopayAllowed: false, // ₹56,640 incl GST > ₹15,000
  },
];

/** All paid SKUs (non-trial, non-enterprise) */
export const PAID_SKUS = BILLING_SKUS.filter(
  (s) => s.cadence !== 'trial' && s.pricePaise > 0
);

export function getSku(skuId: string): BillingSkuDef | undefined {
  return BILLING_SKUS.find((s) => s.id === skuId);
}

export function getSkusByTier(tier: PlanTier): BillingSkuDef[] {
  return BILLING_SKUS.filter((s) => s.planTier === tier);
}

export function getPlanTier(tier: PlanTier): PlanTierDef {
  return PLAN_TIERS[tier];
}

/**
 * Grandfathering: map old plan string → new PlanTier.
 * Used during transition to not strand existing paying orgs.
 */
export function legacyPlanToTier(legacyPlan: string): PlanTier {
  switch ((legacyPlan || '').trim().toLowerCase()) {
    case 'launch':
    case 'kickstart':
      return 'launch';
    case 'starter':
      return 'starter';
    case 'growth':
      return 'growth';
    case 'pro':
    case 'business':
      return 'pro';
    case 'enterprise':
      return 'enterprise';
    default:
      return 'launch';
  }
}

// ---------------------------------------------------------------------------
// LEGACY: kept for backward-compat during transition. Routes still read
// org.plan which can be 'starter'|'growth'|'business'|'enterprise'.
// These will be removed once all orgs are migrated to new PlanTier.
// ---------------------------------------------------------------------------
export interface BillingPlanDef {
  id: string;
  name: string;
  pricePaise: number;
  priceLabel: string;
  seats: number;
  features: string[];
}

/** @deprecated use BILLING_SKUS + PLAN_TIERS */
export const BILLING_PLANS: BillingPlanDef[] = [
  {
    id: 'launch',
    name: 'Kickstart',
    pricePaise: 0,
    priceLabel: '₹0 / 14 days',
    seats: 1,
    features: PLAN_TIERS.launch.features,
  },
  {
    id: 'starter',
    name: 'Starter',
    pricePaise: 99_900,
    priceLabel: '₹999/mo',
    seats: 3,
    features: PLAN_TIERS.starter.features,
  },
  {
    id: 'growth',
    name: 'Growth',
    pricePaise: 249_900,
    priceLabel: '₹2,499/mo',
    seats: 10,
    features: PLAN_TIERS.growth.features,
  },
  {
    id: 'pro',
    name: 'Pro',
    pricePaise: 499_900,
    priceLabel: '₹4,999/mo',
    seats: 25,
    features: PLAN_TIERS.pro.features,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    pricePaise: 0,
    priceLabel: 'Custom',
    seats: 999,
    features: PLAN_TIERS.enterprise.features,
  },
];

/** @deprecated use getSku() */
export function getPlan(planId: string): BillingPlanDef | undefined {
  return BILLING_PLANS.find((p) => p.id === planId);
}
