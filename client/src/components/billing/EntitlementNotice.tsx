import type { EntitlementFeature, EntitlementQuota, PlanTier } from '../../hooks/useEntitlements';

interface EntitlementNoticeProps {
  message: string;
  upgradePlan?: PlanTier;
  compact?: boolean;
  className?: string;
}

/** Plan upsell banners are disabled — Billing page remains the upgrade surface. */
export default function EntitlementNotice(_props: EntitlementNoticeProps) {
  return null;
}

export function featureUpgradeMessage(
  feature: EntitlementFeature,
  upgradePlan: PlanTier,
): string {
  const labels: Record<EntitlementFeature, string> = {
    contacts: 'More contacts',
    contactImport: 'Contact imports',
    team: 'Additional team members',
    whatsapp: 'Another WhatsApp number',
    automations: 'Automation publishing',
    flowPublish: 'Flow publishing',
    aiBots: 'AI bots',
    calling: 'AI calling',
    campaigns: 'Campaign sending',
    templates: 'Template management',
    analytics: 'Advanced analytics',
    integrations: 'Integrations',
    advancedInbox: 'Advanced Inbox tools',
  };
  return `${labels[feature]} require ${upgradePlan[0].toUpperCase() + upgradePlan.slice(1)} or higher.`;
}

export function quotaUpgradeMessage(quota: EntitlementQuota): string {
  const labels: Record<EntitlementQuota, string> = {
    waNumbers: 'WhatsApp number limit reached.',
    seats: 'Team seat limit reached.',
    contacts: 'Contact limit reached.',
    publishedWorkflows: 'Published workflow limit reached.',
  };
  return labels[quota];
}
