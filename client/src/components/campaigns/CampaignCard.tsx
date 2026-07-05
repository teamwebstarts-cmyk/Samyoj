import {
  Calendar,
  Eye,
  LayoutTemplate,
  Pencil,
  Play,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import type { Campaign } from '../../types';
import {
  audienceLabels,
  campaignProgress,
  formatCampaignDate,
  getStatusMeta,
} from './campaignUi';

interface CampaignCardProps {
  campaign: Campaign;
  onView: () => void;
  onEdit?: () => void;
  onSend?: () => void;
  onDelete?: () => void;
}

export default function CampaignCard({
  campaign,
  onView,
  onEdit,
  onSend,
  onDelete,
}: CampaignCardProps) {
  const meta = getStatusMeta(campaign.status);
  const StatusIcon = meta.icon;
  const progress = campaignProgress(campaign.sentCount, campaign.totalContacts);
  const scheduledLabel = formatCampaignDate(campaign.scheduledAt);
  const editable = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED';

  return (
    <article className="bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50">
      <button
        type="button"
        onClick={onView}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
      >
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
          </div>

          <div className="mt-2.5">
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold tabular-nums">
              <span className="text-theme-muted">
                {campaign.sentCount} / {campaign.totalContacts} sent
              </span>
              <span className="text-theme-secondary">{progress}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-theme-subtle">
              <div
                className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${meta.bar}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold tabular-nums">
            <span className="text-sky-700 dark:text-sky-400">{campaign.sentCount} sent</span>
            <span className="text-theme-muted">·</span>
            <span className="text-emerald-700 dark:text-emerald-400">{campaign.deliveredCount} delivered</span>
            <span className="text-theme-muted">·</span>
            <span className="text-violet-700 dark:text-violet-400">{campaign.readCount} read</span>
            {campaign.failedCount > 0 && (
              <>
                <span className="text-theme-muted">·</span>
                <span className="text-red-600 dark:text-red-400">{campaign.failedCount} failed</span>
              </>
            )}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-2 border-t border-theme-border/60 bg-theme-subtle/20 px-3 py-2.5">
        {onSend && editable && (
          <AppButton size="sm" className="flex-1" icon={<Play size={14} />} onClick={onSend}>
            Send
          </AppButton>
        )}
        <AppButton size="sm" className="flex-1" variant="secondary" icon={<Eye size={14} />} onClick={onView}>
          View
        </AppButton>
        {onEdit && editable && (
          <AppButton size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={onEdit}>
            Edit
          </AppButton>
        )}
        {onDelete && editable && (
          <AppButton size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={onDelete} aria-label="Delete" />
        )}
      </div>
    </article>
  );
}
