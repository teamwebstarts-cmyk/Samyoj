import {
  CalendarClock,
  Download,
  Eye,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import CampaignActionsMenu from './CampaignActionsMenu';
import type { Campaign } from '../../types';
import {
  formatCampaignTimestamp,
  getCampaignPrimaryAction,
  getCampaignPrimaryLabel,
  getCampaignProgressDisplay,
  getCampaignRelativeLabel,
  getAudienceLabel,
  getStatusMeta,
  canRescheduleCampaign,
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
  const editable = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED';
  const requestedAction = getCampaignPrimaryAction(campaign.status);
  const primaryAction =
    requestedAction === 'edit' && !onEdit
      ? 'view'
      : requestedAction === 'pause' && !onPause
        ? 'view'
        : requestedAction === 'resume' && !onResume
          ? 'view'
          : requestedAction;
  const primaryLabel = getCampaignPrimaryLabel(campaign, primaryAction);
  const showDelete = Boolean(onDelete && campaign.status === 'DRAFT');
  const showExport = Boolean(onExport && (campaign.status === 'COMPLETED' || campaign.status === 'FAILED' || campaign.sentCount > 0));
  const showRetry = Boolean(onRetry && campaign.status === 'FAILED' && campaign.failedCount > 0);
  const showReschedule = Boolean(onReschedule && canRescheduleCampaign(campaign.status));

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

      <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/40 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/30">
        <AppButton
          size="sm"
          className="flex-1"
          variant="secondary"
          icon={
            primaryAction === 'edit' ? (
              <Pencil size={14} />
            ) : primaryAction === 'pause' ? (
              <Pause size={14} />
            ) : primaryAction === 'resume' ? (
              <Play size={14} />
            ) : (
              <Eye size={14} />
            )
          }
          onClick={
            primaryAction === 'edit'
              ? onEdit
              : primaryAction === 'pause'
                ? onPause
                : primaryAction === 'resume'
                  ? onResume
                  : onView
          }
        >
          {primaryLabel}
        </AppButton>
        {primaryAction !== 'view' && (
          <AppButton size="sm" variant="secondary" icon={<Eye size={14} />} onClick={onView} />
        )}
        {onSend && editable && (
          <AppButton size="sm" variant="secondary" icon={<Play size={14} />} onClick={onSend} />
        )}
        {showExport && (
          <AppButton size="sm" variant="secondary" icon={<Download size={14} />} onClick={onExport} />
        )}
        {showRetry && (
          <AppButton size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={onRetry} />
        )}
        {showReschedule && (
          <AppButton
            size="sm"
            variant="secondary"
            icon={<CalendarClock size={14} />}
            onClick={onReschedule}
            aria-label="Reschedule campaign"
          />
        )}
        {showDelete && (
          <AppButton size="sm" variant="secondary" icon={<Trash2 size={14} />} onClick={onDelete} />
        )}
        <CampaignActionsMenu>
          {showReschedule && (
            <button type="button" onClick={onReschedule} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-fg hover:bg-theme-subtle">
              <CalendarClock className="h-3.5 w-3.5" /> Reschedule
            </button>
          )}
          {editable && onEdit && primaryAction !== 'edit' && (
            <button type="button" onClick={onEdit} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-fg hover:bg-theme-subtle">
              <Pencil className="h-3.5 w-3.5" /> Edit campaign
            </button>
          )}
          {onDelete && editable && !showDelete && (
            <button type="button" onClick={onDelete} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
              <Trash2 className="h-3.5 w-3.5" /> Delete campaign
            </button>
          )}
        </CampaignActionsMenu>
      </div>
    </article>
  );
}
