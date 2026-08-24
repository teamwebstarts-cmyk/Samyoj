import {
  CalendarClock,
  Download,
  Eye,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import type { Campaign } from '../../types';
import CampaignActionsMenu from './CampaignActionsMenu';
import {
  canRescheduleCampaign,
  getCampaignPrimaryAction,
  getCampaignPrimaryLabel,
} from './campaignUi';

const menuBtn =
  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-fg hover:bg-theme-subtle';
const menuBtnDanger =
  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30';

interface CampaignTableActionsProps {
  campaign: Campaign;
  canManageTeam?: boolean;
  onView: (campaign: Campaign) => void;
  onEdit?: (campaign: Campaign) => void;
  onSend?: (campaign: Campaign) => void;
  onPause?: (campaign: Campaign) => void;
  onResume?: (campaign: Campaign) => void;
  onDelete?: (campaign: Campaign) => void;
  onExport?: (campaign: Campaign) => void;
  onRetry?: (campaign: Campaign) => void;
  onReschedule?: (campaign: Campaign) => void;
}

export default function CampaignTableActions({
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
}: CampaignTableActionsProps) {
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

  const showSend = Boolean(onSend && editable);
  const showExport = Boolean(
    onExport && (campaign.status === 'COMPLETED' || campaign.status === 'FAILED' || campaign.sentCount > 0),
  );
  const showRetry = Boolean(onRetry && campaign.status === 'FAILED' && campaign.failedCount > 0);
  const showDelete = Boolean(onDelete && campaign.status === 'DRAFT');
  const showReschedule = Boolean(onReschedule && canRescheduleCampaign(campaign.status));
  const showViewInMenu = primaryAction !== 'view';
  const showEditInMenu = Boolean(onEdit && editable && primaryAction !== 'edit');
  const showPauseInMenu = Boolean(onPause && campaign.status === 'RUNNING' && primaryAction !== 'pause');
  const showResumeInMenu = Boolean(onResume && campaign.status === 'PAUSED' && primaryAction !== 'resume');

  const hasMenuItems =
    showSend ||
    showViewInMenu ||
    showExport ||
    showRetry ||
    showReschedule ||
    showEditInMenu ||
    showPauseInMenu ||
    showResumeInMenu ||
    showDelete;

  const handlePrimary = () => {
    if (primaryAction === 'edit') onEdit?.(campaign);
    else if (primaryAction === 'pause') onPause?.(campaign);
    else if (primaryAction === 'resume') onResume?.(campaign);
    else onView(campaign);
  };

  const PrimaryIcon =
    primaryAction === 'edit'
      ? Pencil
      : primaryAction === 'pause'
        ? Pause
        : primaryAction === 'resume'
          ? Play
          : Eye;

  return (
    <div className="campaign-table-actions flex w-full items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={handlePrimary}
        className="inline-flex h-8 max-w-[8.75rem] min-w-0 shrink items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 text-[11px] font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-950 dark:text-emerald-300 sm:max-w-[9.5rem]"
      >
        <PrimaryIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{primaryLabel}</span>
      </button>

      {hasMenuItems && (
        <CampaignActionsMenu compact>
          {showSend && (
            <button type="button" onClick={() => onSend?.(campaign)} className={menuBtn}>
              <Send className="h-3.5 w-3.5" /> Send now
            </button>
          )}
          {showViewInMenu && (
            <button type="button" onClick={() => onView(campaign)} className={menuBtn}>
              <Eye className="h-3.5 w-3.5" /> View details
            </button>
          )}
          {showEditInMenu && (
            <button type="button" onClick={() => onEdit?.(campaign)} className={menuBtn}>
              <Pencil className="h-3.5 w-3.5" /> Edit campaign
            </button>
          )}
          {showPauseInMenu && (
            <button type="button" onClick={() => onPause?.(campaign)} className={menuBtn}>
              <Pause className="h-3.5 w-3.5" /> Pause sending
            </button>
          )}
          {showResumeInMenu && (
            <button type="button" onClick={() => onResume?.(campaign)} className={menuBtn}>
              <Play className="h-3.5 w-3.5" /> Resume sending
            </button>
          )}
          {showExport && (
            <button type="button" onClick={() => onExport?.(campaign)} className={menuBtn}>
              <Download className="h-3.5 w-3.5" /> Export results
            </button>
          )}
          {showRetry && (
            <button type="button" onClick={() => onRetry?.(campaign)} className={menuBtn}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry failed
            </button>
          )}
          {showReschedule && (
            <button type="button" onClick={() => onReschedule?.(campaign)} className={menuBtn}>
              <CalendarClock className="h-3.5 w-3.5" /> Reschedule
            </button>
          )}
          {showDelete && (
            <button type="button" onClick={() => onDelete?.(campaign)} className={menuBtnDanger}>
              <Trash2 className="h-3.5 w-3.5" /> Delete draft
            </button>
          )}
        </CampaignActionsMenu>
      )}
    </div>
  );
}
