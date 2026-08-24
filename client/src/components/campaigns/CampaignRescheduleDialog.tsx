import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, X } from 'lucide-react';
import AppButton from '../ui/AppButton';
import CampaignSchedulePicker from './wizard/CampaignSchedulePicker';
import { getCampaignScheduleMinimum } from './wizard/campaignWizardModel';
import CampaignRepeatFields, {
  emptyCampaignRepeat,
  type CampaignRepeatValues,
} from './CampaignRepeatFields';
import type { Campaign } from '../../types';

function toDateTimeLocal(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function repeatFromCampaign(campaign: Campaign): CampaignRepeatValues {
  if (!campaign.repeatIntervalDays) return emptyCampaignRepeat;
  return {
    repeatEnabled: true,
    repeatIntervalDays: String(campaign.repeatIntervalDays),
    repeatUntil: toDateTimeLocal(campaign.repeatUntil),
    repeatMaxOccurrences: campaign.repeatMaxOccurrences ? String(campaign.repeatMaxOccurrences) : '',
  };
}

export type CampaignReschedulePayload = {
  scheduledAt: string;
  timezone?: string;
  repeatIntervalDays: number | null;
  repeatUntil: string | null;
  repeatMaxOccurrences: number | null;
};

interface CampaignRescheduleDialogProps {
  campaign: Campaign | null;
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onSave: (payload: CampaignReschedulePayload) => void;
}

export default function CampaignRescheduleDialog({
  campaign,
  open,
  loading,
  onClose,
  onSave,
}: CampaignRescheduleDialogProps) {
  const min = useMemo(() => getCampaignScheduleMinimum(), [open]);
  const [scheduledAt, setScheduledAt] = useState(min);
  const [repeat, setRepeat] = useState<CampaignRepeatValues>(emptyCampaignRepeat);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !campaign) return;
    const existing = toDateTimeLocal(campaign.scheduledAt);
    const existingMs = existing ? new Date(existing).getTime() : 0;
    setScheduledAt(!existing || existingMs <= Date.now() ? min : existing);
    setRepeat(repeatFromCampaign(campaign));
  }, [open, campaign, min]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, loading, onClose]);

  const handleConfirm = () => {
    if (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) return;
    const interval = Number.parseInt(repeat.repeatIntervalDays, 10);
    onSave({
      scheduledAt: new Date(scheduledAt).toISOString(),
      timezone: campaign?.timezone,
      repeatIntervalDays: repeat.repeatEnabled && interval >= 1 ? interval : null,
      repeatUntil:
        repeat.repeatEnabled && repeat.repeatUntil ? new Date(repeat.repeatUntil).toISOString() : null,
      repeatMaxOccurrences:
        repeat.repeatEnabled && Number.parseInt(repeat.repeatMaxOccurrences, 10) >= 1
          ? Number.parseInt(repeat.repeatMaxOccurrences, 10)
          : null,
    });
  };

  if (!open || !campaign || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-3 sm:items-center sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[4px] dark:bg-black/70" aria-hidden />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-title"
        className="relative flex max-h-[min(88vh,720px)] w-full max-w-[400px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="reschedule-title" className="text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                Schedule send
              </h2>
              <p className="mt-0.5 truncate text-[12px] font-medium text-slate-500 dark:text-slate-400">
                {campaign.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <CampaignSchedulePicker value={scheduledAt} min={min} onChange={setScheduledAt} />
          <div className="mt-3">
            <CampaignRepeatFields value={repeat} onChange={setRepeat} minUntil={min} compact />
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:justify-end sm:px-5">
          <AppButton variant="secondary" onClick={onClose} disabled={loading} fullWidth className="sm:min-w-[100px] sm:flex-none">
            Cancel
          </AppButton>
          <AppButton onClick={handleConfirm} loading={loading} fullWidth className="sm:min-w-[120px] sm:flex-none">
            Save schedule
          </AppButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
