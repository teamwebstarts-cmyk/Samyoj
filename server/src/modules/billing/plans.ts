export interface BillingPlanDef {
  id: string;
  name: string;
  pricePaise: number;
  priceLabel: string;
  seats: number;
  features: string[];
}

export const BILLING_PLANS: BillingPlanDef[] = [
  {
    id: 'starter',
    name: 'Starter',
    pricePaise: 0,
    priceLabel: 'Free',
    seats: 5,
    features: ['Shared inbox', 'Basic automations', '500 contacts', '1 WhatsApp number'],
  },
  {
    id: 'growth',
    name: 'Growth',
    pricePaise: 399900,
    priceLabel: '₹3,999/mo',
    seats: 15,
    features: ['AI bots', 'Campaigns', 'Flow builder', 'Analytics'],
  },
  {
    id: 'business',
    name: 'Business',
    pricePaise: 1199900,
    priceLabel: '₹11,999/mo',
    seats: 50,
    features: ['Voice calling', 'Priority support', 'Advanced analytics', 'API access'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    pricePaise: 0,
    priceLabel: 'Custom',
    seats: 200,
    features: ['Unlimited scale', 'Dedicated support', 'Custom integrations', 'SLA'],
  },
];

export function getPlan(planId: string): BillingPlanDef | undefined {
  return BILLING_PLANS.find((p) => p.id === planId);
}
