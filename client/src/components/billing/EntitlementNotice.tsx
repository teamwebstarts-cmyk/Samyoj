import { ArrowUpRight, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { EntitlementFeature, EntitlementQuota, PlanTier } from '../../hooks/useEntitlements';

interface EntitlementNoticeProps {
  message: string;
  upgradePlan?: PlanTier;
  compact?: boolean;
  className?: string;
}

export default function EntitlementNotice({
  message,
  upgradePlan,
  compact = false,
  className = '',
}: EntitlementNoticeProps) {
  return (
    <div
      role="status"
      className={`flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/25 dark:text-amber-200 ${
        compact ? 'px-3 py-2 text-[11px]' : 'px-3.5 py-3 text-[12px]'
      } ${className}`}
    >
      <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{message}</p>
        {upgradePlan && (
          <Link
            to="/billing?tab=plans"
            className="mt-1 inline-flex items-center gap-1 font-bold underline underline-offset-2"
          >
            View {upgradePlan[0].toUpperCase() + upgradePlan.slice(1)} options
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
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
