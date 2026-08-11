import {
  Calendar,
  Eye,
  LayoutTemplate,
  Pause,
  Pencil,
  Play,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import CampaignActionsMenu from './CampaignActionsMenu';
import type { Campaign } from '../../types';
import {
  audienceLabels,
  campaignProgress,
  formatCampaignDate,
  getCampaignPrimaryAction,
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
}

export default function CampaignCard({
  campaign,
  onView,
  onEdit,
  onSend,
  onPause,
  onResume,
  onDelete,
}: CampaignCardProps) {
  const meta = getStatusMeta(campaign.status);
  const StatusIcon = meta.icon;
  const progress = campaignProgress(campaign.sentCount, campaign.totalContacts);
  const scheduledLabel = formatCampaignDate(campaign.scheduledAt, campaign.timezone);
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
  const primaryLabel = primaryAction === 'edit'
    ? 'Edit'
    : primaryAction === 'pause'
      ? 'Pause'
      : primaryAction === 'resume'
        ? 'Resume'
      : campaign.status === 'COMPLETED'
        ? 'View results'
        : 'View';
  const hasOverflowActions =
    (primaryAction !== 'edit' && onEdit && editable) ||
    (primaryAction !== 'pause' && onPause && campaign.status === 'RUNNING') ||
    (primaryAction !== 'resume' && onResume && campaign.status === 'PAUSED') ||
    (onDelete && editable);

  return (
    <article className="bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50">
      <div className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-[0_4px_14px_rgba(139,92,246,0.3)]">
          <Send className="h-4 w-4" strokeWidth={2.25} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[13px] font-bold text-theme-fg">{campaign.name}</h3>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${meta.badge}`}
            >
              <StatusIcon
                className={`h-3 w-3 ${meta.pulse ? 'animate-spin' : ''}`}
                strokeWidth={2.5}
              />
              {meta.label}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-300">
              <LayoutTemplate className="h-3 w-3" />
              {campaign.templateName}
            </span>
            {campaign.audienceType && (
              <span className="inline-flex items-center gap-1 rounded-full bg-theme-subtle px-2 py-0.5 text-[10px] font-bold text-theme-secondary ring-1 ring-theme-border">
                <Users className="h-3 w-3" />
                {audienceLabels[campaign.audienceType] || campaign.audienceType}
              </span>
            )}
            {scheduledLabel && campaign.status === 'SCHEDULED' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300">
                <Calendar className="h-3 w-3" />
                {scheduledLabel}
              </span>
            )}
            <span className="text-[10px] font-bold text-theme-secondary">
              {campaign.totalContacts.toLocaleString()} recipients
            </span>
          </div>

          <div className="mt-2.5">
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold tabular-nums" aria-live="polite" aria-atomic="true">
              <span className="text-theme-muted">
                {campaign.sentCount} / {campaign.totalContacts} sent
              </span>
              <span className="text-theme-secondary">{progress}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-theme-subtle">
              <div
                className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${meta.bar}`}
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${campaign.name}: ${progress}% sent, ${campaign.sentCount} of ${campaign.totalContacts} recipients`}
              />
            </div>
          </div>

        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-theme-border/60 bg-theme-subtle/20 px-3 py-2.5">
        <AppButton
          size="sm"
          className="flex-1"
          variant={primaryAction === 'edit' ? 'primary' : 'secondary'}
          icon={primaryAction === 'edit' ? <Pencil size={14} /> : primaryAction === 'pause' ? <Pause size={14} /> : primaryAction === 'resume' ? <Play size={14} /> : <Eye size={14} />}
          onClick={primaryAction === 'edit' ? onEdit : primaryAction === 'pause' ? onPause : primaryAction === 'resume' ? onResume : onView}
          disabled={primaryAction === 'edit' ? !onEdit : primaryAction === 'pause' ? !onPause : primaryAction === 'resume' ? !onResume : !onView}
        >
          {primaryLabel}
        </AppButton>
        {primaryAction !== 'view' && onView && (
          <AppButton size="sm" variant="secondary" icon={<Eye size={14} />} onClick={onView}>
            View
          </AppButton>
        )}
        {onSend && editable && (
          <AppButton size="sm" variant="secondary" icon={<Play size={14} />} onClick={onSend}>
            Send
          </AppButton>
        )}
        {hasOverflowActions && <CampaignActionsMenu>
            {primaryAction !== 'edit' && onEdit && editable && (
              <button type="button" onClick={onEdit} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-fg hover:bg-theme-subtle">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            )}
            {onDelete && editable && (
              <button type="button" onClick={onDelete} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </CampaignActionsMenu>
        }
      </div>
    </article>
  );
}
