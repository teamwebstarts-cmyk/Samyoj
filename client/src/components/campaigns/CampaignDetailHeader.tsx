import { Calendar, LayoutTemplate, Users } from 'lucide-react';
import { ModalPanel } from '../ui/modalUi';
import StatusBadge from '../ui/StatusBadge';
import type { Campaign } from '../../types';
import { audienceLabels, formatCampaignDate } from './campaignUi';

interface CampaignDetailHeaderProps {
  campaign: Campaign;
}

export default function CampaignDetailHeader({ campaign }: CampaignDetailHeaderProps) {
  const scheduledLabel = formatCampaignDate(campaign.scheduledAt);

  return (
    <ModalPanel title="Campaign overview" accent="violet">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={campaign.status} />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-theme-subtle px-2.5 py-0.5 font-mono text-[11px] font-semibold text-theme-fg ring-1 ring-theme-border">
          <LayoutTemplate className="h-3 w-3 text-violet-500" />
          {campaign.templateName}
        </span>
        {campaign.audienceType && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-theme-subtle px-2.5 py-0.5 text-[11px] font-semibold text-theme-secondary ring-1 ring-theme-border">
            <Users className="h-3 w-3" />
            {audienceLabels[campaign.audienceType] || campaign.audienceType}
          </span>
        )}
        {scheduledLabel && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300">
            <Calendar className="h-3 w-3" />
            {scheduledLabel}
          </span>
        )}
      </div>

      <p className="mt-3 text-lg font-extrabold tracking-tight text-theme-fg">{campaign.name}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: 'Recipients', value: campaign.totalContacts },
          { label: 'Sent', value: campaign.sentCount, tone: 'text-sky-700 dark:text-sky-400' },
          {
            label: 'Delivered',
            value: campaign.deliveredCount,
            tone: 'text-emerald-700 dark:text-emerald-400',
          },
          { label: 'Read', value: campaign.readCount, tone: 'text-violet-700 dark:text-violet-400' },
          { label: 'Failed', value: campaign.failedCount, tone: 'text-red-600 dark:text-red-400' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-theme-subtle/60 px-3 py-2.5 ring-1 ring-theme-border"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">{stat.label}</p>
            <p className={`mt-0.5 text-lg font-extrabold tabular-nums ${stat.tone || 'text-theme-fg'}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </ModalPanel>
  );
}
