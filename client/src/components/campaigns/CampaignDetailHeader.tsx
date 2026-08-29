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

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="px-4 py-4 sm:px-5">
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
        <div className="mt-3 h-1.5 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-lg transition-all duration-500 ${meta.bar}`}
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progress}% sent`}
          />
        </div>
      </div>
    </section>
  );
}
