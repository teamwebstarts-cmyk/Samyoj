import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import type { Campaign } from '../../types';
import CampaignActionsMenu from './CampaignActionsMenu';
import {
  formatCampaignTimestamp,
  getCampaignPrimaryAction,
  getCampaignPrimaryLabel,
  getCampaignProgressDisplay,
  getCampaignRelativeLabel,
  getAudienceLabel,
  getStatusMeta,
} from './campaignUi';

export type CampaignSortKey = 'name' | 'status' | 'totalContacts' | 'progress' | 'createdAt';

interface CampaignTableProps {
  campaigns: Campaign[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  sortBy?: CampaignSortKey;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: CampaignSortKey) => void;
  canManageTeam: boolean;
  onView: (campaign: Campaign) => void;
  onEdit?: (campaign: Campaign) => void;
  onSend?: (campaign: Campaign) => void;
  onPause?: (campaign: Campaign) => void;
  onResume?: (campaign: Campaign) => void;
  onDelete?: (campaign: Campaign) => void;
  onExport?: (campaign: Campaign) => void;
  onRetry?: (campaign: Campaign) => void;
}

const sortableHeaders: Array<{ key: CampaignSortKey | null; label: string }> = [
  { key: 'name', label: 'Campaign' },
  { key: 'status', label: 'Status' },
  { key: 'totalContacts', label: 'Audience' },
  { key: 'progress', label: 'Progress' },
  { key: null, label: 'Actions' },
];

export default function CampaignTable({
  campaigns,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  sortBy = 'createdAt',
  sortDir = 'desc',
  onSort,
  onView,
  onEdit,
  onSend,
  onPause,
  onResume,
  onDelete,
  onExport,
  onRetry,
}: CampaignTableProps) {
  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-0 table-fixed text-sm">
          <thead>
            <tr className="border-b border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
              {sortableHeaders.map((header) => {
                const active = header.key && sortBy === header.key;
                const SortIcon = !header.key
                  ? null
                  : active
                    ? sortDir === 'asc'
                      ? ArrowUp
                      : ArrowDown
                    : ArrowUpDown;
                return (
                  <th
                    key={header.label}
                    scope="col"
                    className={`px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400 ${
                      header.label === 'Actions' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {header.key && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(header.key!)}
                        className="inline-flex items-center gap-1.5 rounded-md transition hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:hover:text-slate-200"
                      >
                        {header.label}
                        {SortIcon && <SortIcon className="h-3.5 w-3.5 opacity-70" />}
                      </button>
                    ) : (
                      header.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => {
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
              const showSend = Boolean(onSend && editable);

              return (
                <tr key={campaign.id} className="border-b border-slate-100 transition hover:bg-slate-50/70 dark:border-slate-800/80 dark:hover:bg-slate-900/40">
                  <td className="px-4 py-4 align-top">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tile}`}>
                        <TileIcon className="h-4 w-4" strokeWidth={2.25} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-bold text-slate-900 dark:text-white">{campaign.name}</p>
                        <span className={`mt-1 inline-flex max-w-full truncate rounded-lg px-1.5 py-0.5 font-mono text-[10px] font-semibold ${meta.templatePill}`}>
                          {campaign.templateName}
                        </span>
                        {timestamp && (
                          <p className="mt-1.5 text-[11px] font-medium text-slate-400">{timestamp}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold ring-1 ${meta.badge}`}>
                      <StatusIcon className={`h-3 w-3 ${meta.pulse ? 'animate-pulse' : ''}`} strokeWidth={2.5} />
                      {meta.label}
                    </span>
                    {relative && <p className="mt-1.5 text-[11px] font-medium text-slate-400">{relative}</p>}
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="flex items-start gap-1.5">
                      <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                          {campaign.audienceType ? getAudienceLabel(campaign.audienceType) : 'Audience'}
                        </p>
                        <p className="mt-0.5 text-[15px] font-extrabold tabular-nums text-slate-900 dark:text-white">
                          {campaign.totalContacts.toLocaleString()}
                          <span className="ml-1 text-[11px] font-medium text-slate-400">recipients</span>
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    {progress.kind === 'empty' ? (
                      <div className="space-y-2">
                        <p className="text-[13px] font-bold text-slate-400">—</p>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" />
                      </div>
                    ) : (
                      <div className="min-w-[140px] space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[12px] font-semibold tabular-nums">
                          <span className="font-extrabold text-slate-900 dark:text-white">{progress.percent}%</span>
                          <span className="text-slate-400">{progress.fraction}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
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
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          primaryAction === 'edit'
                            ? onEdit?.(campaign)
                            : primaryAction === 'pause'
                              ? onPause?.(campaign)
                              : primaryAction === 'resume'
                                ? onResume?.(campaign)
                                : onView(campaign)
                        }
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 text-[11px] font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-950 dark:text-emerald-300"
                      >
                        {primaryAction === 'edit' ? (
                          <Pencil className="h-3.5 w-3.5" />
                        ) : primaryAction === 'pause' ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : primaryAction === 'resume' ? (
                          <Play className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        {primaryLabel}
                      </button>

                      {primaryAction !== 'view' && (
                        <button
                          type="button"
                          onClick={() => onView(campaign)}
                          aria-label="View campaign"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {showSend && (
                        <button
                          type="button"
                          onClick={() => onSend?.(campaign)}
                          aria-label="Send now"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {showExport && (
                        <button
                          type="button"
                          onClick={() => onExport?.(campaign)}
                          aria-label="Download results"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {showRetry && (
                        <button
                          type="button"
                          onClick={() => onRetry?.(campaign)}
                          aria-label="Retry failed sends"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {showDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete?.(campaign)}
                          aria-label="Delete campaign"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-500 transition hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-950"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <CampaignActionsMenu>
                        {editable && onEdit && primaryAction !== 'edit' && (
                          <button type="button" onClick={() => onEdit(campaign)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-fg hover:bg-theme-subtle">
                            <Pencil className="h-3.5 w-3.5" /> Edit campaign
                          </button>
                        )}
                        {onPause && campaign.status === 'RUNNING' && primaryAction !== 'pause' && (
                          <button type="button" onClick={() => onPause(campaign)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-fg hover:bg-theme-subtle">
                            <Pause className="h-3.5 w-3.5" /> Pause
                          </button>
                        )}
                        {onResume && campaign.status === 'PAUSED' && primaryAction !== 'resume' && (
                          <button type="button" onClick={() => onResume(campaign)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-fg hover:bg-theme-subtle">
                            <Play className="h-3.5 w-3.5" /> Resume
                          </button>
                        )}
                        {showExport && (
                          <button type="button" onClick={() => onExport?.(campaign)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-fg hover:bg-theme-subtle">
                            <Download className="h-3.5 w-3.5" /> Export results
                          </button>
                        )}
                        {editable && onDelete && !showDelete && (
                          <button type="button" onClick={() => onDelete(campaign)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                            <Trash2 className="h-3.5 w-3.5" /> Delete campaign
                          </button>
                        )}
                      </CampaignActionsMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CampaignListPagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}

function CampaignListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] font-medium text-slate-500">
        Showing <span className="font-bold text-slate-800 dark:text-slate-200">{start}</span> to{' '}
        <span className="font-bold text-slate-800 dark:text-slate-200">{end}</span> of{' '}
        <span className="font-bold text-slate-800 dark:text-slate-200">{total}</span> campaigns
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950"
          aria-label="Previous page"
        >
          ‹
        </button>
        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-emerald-600 px-2 text-[12px] font-bold text-white">
          {safePage}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950"
          aria-label="Next page"
        >
          ›
        </button>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
            aria-label="Campaigns per page"
          >
            {[10, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
