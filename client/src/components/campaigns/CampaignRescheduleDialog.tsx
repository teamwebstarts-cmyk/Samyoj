import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import ConfirmDialog from '../ui/ConfirmDialog';
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
  const min = getCampaignScheduleMinimum();
  const [scheduledAt, setScheduledAt] = useState(min);
  const [repeat, setRepeat] = useState<CampaignRepeatValues>(emptyCampaignRepeat);

  useEffect(() => {
    if (!open || !campaign) return;
    const existing = toDateTimeLocal(campaign.scheduledAt);
    const existingMs = existing ? new Date(existing).getTime() : 0;
    setScheduledAt(!existing || existingMs <= Date.now() ? min : existing);
    setRepeat(repeatFromCampaign(campaign));
  }, [open, campaign, min]);

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

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Reschedule campaign"
      description="Pick a future send time. Repeats keep the same audience and only go to people who agreed to campaign messages."
      confirmLabel="Save schedule"
      icon={CalendarClock}
      loading={loading}
    >
      <div className="space-y-3">
        <CampaignSchedulePicker value={scheduledAt} min={min} onChange={setScheduledAt} />
        <CampaignRepeatFields value={repeat} onChange={setRepeat} minUntil={min} />
      </div>
    </ConfirmDialog>
  );
}
