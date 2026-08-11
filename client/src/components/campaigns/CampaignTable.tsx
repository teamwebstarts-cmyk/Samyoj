import { Calendar, Eye, LayoutTemplate, Pause, Pencil, Play, Send, Trash2, Users } from 'lucide-react';
import DataTable from '../ui/DataTable';
import { TableIconButton, TableTextButton } from '../ui/TableActions';
import type { Campaign } from '../../types';
import CampaignActionsMenu from './CampaignActionsMenu';
import {
  campaignProgress,
  formatCampaignDate,
  getAudienceLabel,
  getCampaignPrimaryAction,
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
  onPause?: (campaign: Campaign) => void;
  onResume?: (campaign: Campaign) => void;
  onDelete?: (campaign: Campaign) => void;
}

export default function CampaignTable({
  campaigns,
  page,
  pageSize,
  total,
  onPageChange,
  onView,
  onEdit,
  onSend,
  onPause,
  onResume,
  onDelete,
}: CampaignTableProps) {
  return (
    <DataTable
      headers={[
        'Campaign',
        'Status',
        'Audience',
        'Progress',
        'Actions',
      ]}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={onPageChange}
      minTableWidth="min-w-0"
      tableClassName="table-fixed"
      serialNo={false}
    >
      {campaigns.map((campaign) => {
        const meta = getStatusMeta(campaign.status);
        const StatusIcon = meta.icon;
        const progress = campaignProgress(campaign.sentCount, campaign.totalContacts);
        const editable = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED';
        const requestedAction = getCampaignPrimaryAction(campaign.status);
        const primaryAction =
          requestedAction === 'edit' && !onEdit
            ? 'view'
            : requestedAction === 'pause' && !onPause
              ? 'view'
              : requestedAction;
        const resolvedPrimaryAction =
          primaryAction === 'resume' && !onResume ? 'view' : primaryAction;
        const primaryLabel = resolvedPrimaryAction === 'edit'
          ? 'Edit'
          : resolvedPrimaryAction === 'pause'
            ? 'Pause'
            : resolvedPrimaryAction === 'resume'
              ? 'Resume'
            : campaign.status === 'COMPLETED'
              ? 'View results'
              : 'View campaign';

        return (
          <tr key={campaign.id} className="group">
            <td className="min-w-[200px]">
              <div className="flex w-full items-center gap-3 py-1">
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
              </div>
            </td>

            <td className="whitespace-nowrap">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${meta.badge}`}
              >
                <StatusIcon
                  className={`h-3 w-3 ${meta.pulse ? 'animate-spin' : ''}`}
                  strokeWidth={2.5}
                />
                {meta.label}
              </span>
              {campaign.status === 'SCHEDULED' && campaign.scheduledAt && (
                <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-theme-muted">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span className="truncate">{formatCampaignDate(campaign.scheduledAt, campaign.timezone)}</span>
                </span>
              )}
            </td>

            <td className="whitespace-nowrap">
              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 text-[13px] font-bold tabular-nums text-theme-fg">
                  <Users className="h-3 w-3 shrink-0 text-theme-muted" />
                  {campaign.totalContacts.toLocaleString()} recipients
                </span>
                {campaign.audienceType && (
                  <span className="text-[10px] font-semibold text-theme-muted">
                    {getAudienceLabel(campaign.audienceType)}
                  </span>
                )}
              </div>
            </td>

            <td className="min-w-[140px]">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold tabular-nums" aria-live="polite" aria-atomic="true">
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
              <div className="flex items-center justify-end gap-1.5">
                <TableTextButton
                  onClick={() => (resolvedPrimaryAction === 'edit' ? onEdit?.(campaign) : resolvedPrimaryAction === 'pause' ? onPause?.(campaign) : resolvedPrimaryAction === 'resume' ? onResume?.(campaign) : onView(campaign))}
                  icon={resolvedPrimaryAction === 'edit' ? Pencil : resolvedPrimaryAction === 'pause' ? Pause : resolvedPrimaryAction === 'resume' ? Play : Eye}
                  variant={resolvedPrimaryAction === 'edit' || resolvedPrimaryAction === 'resume' ? 'primary' : 'neutral'}
                >
                  {primaryLabel}
                </TableTextButton>
                {resolvedPrimaryAction !== 'view' && onView && (
                  <TableIconButton onClick={() => onView(campaign)} icon={Eye} label="View campaign" />
                )}
                {onSend && editable && (
                  <TableIconButton onClick={() => onSend(campaign)} icon={Play} label="Send now" variant="primary" />
                )}
                {(resolvedPrimaryAction !== 'edit' && onEdit && editable) ||
                (resolvedPrimaryAction !== 'pause' && onPause && campaign.status === 'RUNNING') ||
                (resolvedPrimaryAction !== 'resume' && onResume && campaign.status === 'PAUSED') ||
                (onDelete && editable) ? (
                  <CampaignActionsMenu>
                      {resolvedPrimaryAction !== 'edit' && onEdit && editable && (
                        <button type="button" onClick={() => onEdit(campaign)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-fg hover:bg-theme-subtle">
                          <Pencil className="h-3.5 w-3.5" /> Edit campaign
                        </button>
                      )}
                      {resolvedPrimaryAction !== 'pause' && onPause && campaign.status === 'RUNNING' && (
                        <button type="button" onClick={() => onPause(campaign)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-fg hover:bg-theme-subtle">
                          <Pause className="h-3.5 w-3.5" /> Pause
                        </button>
                      )}
                      {resolvedPrimaryAction !== 'resume' && onResume && campaign.status === 'PAUSED' && (
                        <button type="button" onClick={() => onResume(campaign)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-fg hover:bg-theme-subtle">
                          <Play className="h-3.5 w-3.5" /> Resume
                        </button>
                      )}
                      {onDelete && editable && (
                        <button type="button" onClick={() => onDelete(campaign)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                          <Trash2 className="h-3.5 w-3.5" /> Delete campaign
                        </button>
                      )}
                  </CampaignActionsMenu>
                ) : null}
              </div>
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}
