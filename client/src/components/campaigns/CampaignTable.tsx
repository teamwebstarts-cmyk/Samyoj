import { Calendar, LayoutTemplate, Play, Send, Users } from 'lucide-react';
import DataTable, { TableSerialCell } from '../ui/DataTable';
import RowActions from '../ui/RowActions';
import { TableTextButton } from '../ui/TableActions';
import type { Campaign } from '../../types';
import {
  audienceLabels,
  campaignProgress,
  formatCampaignDate,
  getStatusMeta,
} from './campaignUi';

interface CampaignTableProps {
  campaigns: Campaign[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  canManageTeam: boolean;
  onView: (campaign: Campaign) => void;
  onEdit?: (campaign: Campaign) => void;
  onSend?: (campaign: Campaign) => void;
  onDelete?: (campaign: Campaign) => void;
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="text-center">
      <p className={`text-[13px] font-extrabold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-theme-muted">{label}</p>
    </div>
  );
}

export default function CampaignTable({
  campaigns,
  page,
  pageSize,
  total,
  onPageChange,
  canManageTeam,
  onView,
  onEdit,
  onSend,
  onDelete,
}: CampaignTableProps) {
  return (
    <DataTable
      headers={[
        'Campaign',
        'Status',
        'Audience',
        'Progress',
        'Delivery',
        'Scheduled',
        'Actions',
      ]}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={onPageChange}
      minTableWidth="min-w-[1080px]"
    >
      {campaigns.map((campaign, index) => {
        const meta = getStatusMeta(campaign.status);
        const StatusIcon = meta.icon;
        const progress = campaignProgress(campaign.sentCount, campaign.totalContacts);
        const scheduledLabel = formatCampaignDate(campaign.scheduledAt);
        const editable = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED';

        return (
          <tr key={campaign.id} className="group">
            <TableSerialCell page={page} pageSize={pageSize} rowIndex={index} />

            <td className="min-w-[200px]">
              <button
                type="button"
                onClick={() => onView(campaign)}
                className="flex w-full items-center gap-3 rounded-xl py-1 text-left transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-500/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-[0_4px_14px_rgba(139,92,246,0.3)]">
                  <Send className="h-4 w-4" strokeWidth={2.25} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-theme-fg group-hover:text-whatsapp-700 dark:group-hover:text-whatsapp-400">
                    {campaign.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-medium text-theme-muted">
                    <LayoutTemplate className="h-3 w-3 shrink-0" />
                    {campaign.templateName}
                  </p>
                </div>
              </button>
            </td>

            <td className="whitespace-nowrap">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${meta.badge}`}
              >
                <StatusIcon
                  className={`h-3 w-3 ${meta.pulse ? 'animate-spin' : ''}`}
                  strokeWidth={2.5}
                />
                {meta.label}
              </span>
            </td>

            <td className="whitespace-nowrap">
              {campaign.audienceType ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-theme-subtle px-2.5 py-1 text-[11px] font-bold text-theme-secondary ring-1 ring-theme-border">
                  <Users className="h-3 w-3 shrink-0 text-theme-muted" />
                  {audienceLabels[campaign.audienceType] || campaign.audienceType}
                </span>
              ) : (
                <span className="text-[13px] text-theme-muted">—</span>
              )}
            </td>

            <td className="min-w-[140px]">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold tabular-nums">
                  <span className="text-theme-muted">{progress}%</span>
                  <span className="text-theme-secondary">
                    {campaign.sentCount}/{campaign.totalContacts}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-theme-subtle">
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
            </td>

            <td>
              <details className="group/delivery">
                <summary className="flex min-w-[150px] cursor-pointer list-none items-center gap-2 rounded-lg px-1 py-1 text-left focus:outline-none focus:ring-2 focus:ring-violet-500/40">
                  <span className="text-[12px] font-semibold tabular-nums text-theme-secondary">
                    {campaign.deliveredCount.toLocaleString()} delivered
                  </span>
                  <span className="text-[11px] font-bold text-theme-muted group-open/delivery:hidden">
                    · details
                  </span>
                  <span className="text-[11px] font-bold text-theme-muted group-open/delivery:inline hidden">
                    · hide
                  </span>
                </summary>
                <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg border border-theme-border bg-theme-subtle/50 p-2">
                  <StatPill label="Sent" value={campaign.sentCount} tone="text-sky-700 dark:text-sky-400" />
                  <StatPill
                    label="Read"
                    value={campaign.readCount}
                    tone="text-violet-700 dark:text-violet-400"
                  />
                  <StatPill
                    label="Failed"
                    value={campaign.failedCount}
                    tone={
                      campaign.failedCount > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-theme-muted'
                    }
                  />
                </div>
              </details>
            </td>

            <td className="whitespace-nowrap">
              {scheduledLabel && campaign.status === 'SCHEDULED' ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-800 dark:text-amber-300">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {scheduledLabel}
                </span>
              ) : (
                <span className="text-[13px] text-theme-muted">—</span>
              )}
            </td>

            <td>
              <div className="flex items-center justify-end gap-1.5">
                {canManageTeam && onSend && editable && (
                  <TableTextButton onClick={() => onSend(campaign)} icon={Play}>
                    Send
                  </TableTextButton>
                )}
                <RowActions
                  onView={() => onView(campaign)}
                  onEdit={canManageTeam && onEdit && editable ? () => onEdit(campaign) : undefined}
                  onDelete={
                    canManageTeam && onDelete && editable ? () => onDelete(campaign) : undefined
                  }
                />
              </div>
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}
