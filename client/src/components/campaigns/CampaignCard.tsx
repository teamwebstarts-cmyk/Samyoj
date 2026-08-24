import { Users } from 'lucide-react';
import CampaignTableActions from './CampaignTableActions';
import type { Campaign } from '../../types';
import {
  formatCampaignTimestamp,
  getCampaignProgressDisplay,
  getCampaignRelativeLabel,
  getAudienceLabel,
  getStatusMeta,
} from './campaignUi';

interface CampaignCardProps {
  campaign: Campaign;
  onView: () => void;
  onEdit?: () => void;
  onSend?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  onRetry?: () => void;
  onReschedule?: () => void;
}

export default function CampaignCard({
  campaign,
  onView,
  onEdit,
  onSend,
  onPause,
  onResume,
  onDelete,
  onExport,
  onRetry,
  onReschedule,
}: CampaignCardProps) {
  const meta = getStatusMeta(campaign.status);
  const StatusIcon = meta.icon;
  const TileIcon = meta.tileIcon;
  const progress = getCampaignProgressDisplay(campaign);
  const relative = getCampaignRelativeLabel(campaign);
  const timestamp = formatCampaignTimestamp(campaign.createdAt);

  return (
    <article className="bg-white transition-colors hover:bg-slate-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50">
      <div className="flex w-full items-start gap-3 px-4 py-4 text-left">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tile}`}>
          <TileIcon className="h-4 w-4" strokeWidth={2.25} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[14px] font-bold text-slate-900 dark:text-white">{campaign.name}</h3>
              <span className={`mt-1 inline-flex max-w-full truncate rounded-lg px-1.5 py-0.5 font-mono text-[10px] font-semibold ${meta.templatePill}`}>
                {campaign.templateName}
              </span>
              {timestamp && <p className="mt-1.5 text-[11px] font-medium text-slate-400">{timestamp}</p>}
            </div>
            <div className="shrink-0 text-right">
              <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[9px] font-bold ring-1 ${meta.badge}`}>
                <StatusIcon className={`h-3 w-3 ${meta.pulse ? 'animate-pulse' : ''}`} strokeWidth={2.5} />
                {meta.label}
              </span>
              {relative && <p className="mt-1 text-[10px] font-medium text-slate-400">{relative}</p>}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-slate-500 dark:text-slate-400">
              {campaign.audienceType ? getAudienceLabel(campaign.audienceType) : 'Audience'}
            </span>
            <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
              {campaign.totalContacts.toLocaleString()}
            </span>
          </div>

          <div className="mt-2.5">
            {progress.kind === 'empty' ? (
              <>
                <p className="text-[12px] font-bold text-slate-400">—</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold tabular-nums">
                  <span className="font-extrabold text-slate-900 dark:text-white">{progress.percent}%</span>
                  <span className="text-slate-400">{progress.fraction}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all ${meta.bar}`}
                    style={{ width: `${progress.percent}%` }}
                    role="progressbar"
                    aria-valuenow={progress.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${campaign.name}: ${progress.percent}% sent`}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center border-t border-slate-100 bg-slate-50/40 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/30">
        <div className="w-full">
          <CampaignTableActions
            campaign={campaign}
            onView={() => onView()}
            onEdit={onEdit ? () => onEdit() : undefined}
            onSend={onSend ? () => onSend() : undefined}
            onPause={onPause ? () => onPause() : undefined}
            onResume={onResume ? () => onResume() : undefined}
            onDelete={onDelete ? () => onDelete() : undefined}
            onExport={onExport ? () => onExport() : undefined}
            onRetry={onRetry ? () => onRetry() : undefined}
            onReschedule={onReschedule ? () => onReschedule() : undefined}
          />
        </div>
      </div>
    </article>
  );
}
