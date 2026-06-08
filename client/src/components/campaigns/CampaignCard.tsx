import {
  Calendar,
  CheckCircle2,
  Eye,
  LayoutTemplate,
  Pencil,
  Play,
  Send,
  Trash2,
  Users,
  XCircle,
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
  const deliveryRate =
    campaign.sentCount > 0
      ? Math.round((campaign.deliveredCount / campaign.sentCount) * 100)
      : null;

  return (
    <article className="dashboard-card group overflow-hidden p-0 transition hover:shadow-panel">
      <button
        type="button"
        onClick={onView}
        className="flex w-full flex-col p-4 text-left active:bg-neutral-50/50 sm:p-5"
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)] sm:h-12 sm:w-12">
            <Send className="h-5 w-5" strokeWidth={2.25} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate text-[15px] font-extrabold tracking-tight text-neutral-900 dark:text-slate-100 sm:text-base">
                {campaign.name}
              </h3>
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

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/50">
                <LayoutTemplate className="h-3 w-3" />
                {campaign.templateName}
              </span>
              {campaign.audienceType && (
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600 ring-1 ring-neutral-200/60 dark:bg-slate-800 dark:text-slate-300">
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
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
            <span className="text-neutral-500 dark:text-slate-400">Delivery progress</span>
            <span className="tabular-nums text-neutral-700 dark:text-slate-200">
              {campaign.sentCount} / {campaign.totalContacts}
              <span className="ml-1 text-neutral-400">({progress}%)</span>
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${meta.bar}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-2">
          {[
            { label: 'Recipients', value: campaign.totalContacts, tone: 'text-neutral-800 dark:text-slate-200' },
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
              className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 px-2 py-2 text-center dark:border-slate-700 dark:bg-slate-800/50"
            >
              <p className={`text-sm font-extrabold tabular-nums ${stat.tone}`}>{stat.value}</p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {deliveryRate !== null && campaign.status === 'COMPLETED' && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {deliveryRate}% delivery rate
          </p>
        )}

        {campaign.failedCount > 0 && campaign.status !== 'DRAFT' && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
            <XCircle className="h-3.5 w-3.5" />
            {campaign.failedCount} failed — retry from details
          </p>
        )}
      </button>

      <div className="flex flex-wrap gap-2 border-t border-neutral-100/80 bg-neutral-50/40 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900/30">
        {onSend && (
          <AppButton size="sm" className="min-w-[5.5rem] flex-1" icon={<Play size={14} />} onClick={onSend}>
            Send
          </AppButton>
        )}
        <AppButton
          size="sm"
          className="min-w-[5.5rem] flex-1"
          variant="secondary"
          icon={<Eye size={14} />}
          onClick={onView}
        >
          View
        </AppButton>
        {onEdit && (
          <AppButton
            size="sm"
            className="min-w-[5.5rem] flex-1"
            variant="secondary"
            icon={<Pencil size={14} />}
            onClick={onEdit}
          >
            Edit
          </AppButton>
        )}
        {onDelete && (
          <AppButton
            size="sm"
            className="min-w-[5.5rem] flex-1"
            variant="danger"
            icon={<Trash2 size={14} />}
            onClick={onDelete}
          >
            Delete
          </AppButton>
        )}
      </div>
    </article>
  );
}
