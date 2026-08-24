import { LayoutTemplate } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import type { Campaign } from '../../types';
import { campaignProgress, getStatusMeta } from './campaignUi';

interface CampaignDetailHeaderProps {
  campaign: Campaign;
}

export default function CampaignDetailHeader({ campaign }: CampaignDetailHeaderProps) {
  const meta = getStatusMeta(campaign.status);
  const progress = campaignProgress(campaign.sentCount, campaign.totalContacts);
  const delivered = campaign.deliveredCount ?? 0;
  const read = campaign.readCount ?? 0;
  const failed = campaign.failedCount ?? 0;

  const stats = [
    {
      label: 'Delivered',
      value: delivered,
      tone: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50/80 dark:bg-emerald-950/30',
    },
    {
      label: 'Read',
      value: read,
      tone: 'text-violet-700 dark:text-violet-400',
      bg: 'bg-violet-50/80 dark:bg-violet-950/30',
    },
    {
      label: 'Failed',
      value: failed,
      tone: failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400',
      bg: failed > 0 ? 'bg-red-50/80 dark:bg-red-950/30' : 'bg-slate-50/80 dark:bg-slate-900/40',
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-slate-50/90 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/80">
      <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={campaign.status}
            label={meta.label}
            className="normal-case tracking-normal"
          />
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/90 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
            <LayoutTemplate className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            {campaign.templateName}
          </span>
        </div>
        <h2 className="mt-3 text-[1.15rem] font-extrabold leading-snug tracking-tight text-slate-900 dark:text-white">
          {campaign.name}
        </h2>
        <p className="mt-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
          {campaign.sentCount.toLocaleString()} of {campaign.totalContacts.toLocaleString()} sent
          {progress >= 100 ? ' · Complete' : campaign.status === 'RUNNING' ? ' · Sending' : ''}
        </p>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${meta.bar}`}
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progress}% delivered`}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl px-3 py-2.5 text-center ring-1 ring-slate-200/70 dark:ring-slate-800 ${stat.bg}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {stat.label}
              </p>
              <p className={`mt-0.5 text-xl font-extrabold tabular-nums ${stat.tone}`}>
                {stat.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
