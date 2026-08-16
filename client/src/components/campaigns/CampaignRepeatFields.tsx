import AppInput from '../ui/AppInput';

export type CampaignRepeatValues = {
  repeatEnabled: boolean;
  repeatIntervalDays: string;
  repeatUntil: string;
  repeatMaxOccurrences: string;
};

export const emptyCampaignRepeat: CampaignRepeatValues = {
  repeatEnabled: false,
  repeatIntervalDays: '2',
  repeatUntil: '',
  repeatMaxOccurrences: '',
};

interface CampaignRepeatFieldsProps {
  value: CampaignRepeatValues;
  onChange: (next: CampaignRepeatValues) => void;
  minUntil?: string;
}

/** Repeat every N days — used on wizard review and existing-campaign reschedule. */
export default function CampaignRepeatFields({ value, onChange, minUntil }: CampaignRepeatFieldsProps) {
  const set = (patch: Partial<CampaignRepeatValues>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950">
        <input
          type="checkbox"
          checked={value.repeatEnabled}
          onChange={(e) => set({ repeatEnabled: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30"
        />
        <span>
          <span className="block text-[12px] font-bold text-slate-800 dark:text-slate-100">
            Repeat this campaign
          </span>
          <span className="mt-0.5 block text-[11px] font-medium text-slate-500">
            Send again to the same audience every few days. People who did not agree to campaigns stay out.
          </span>
        </span>
      </label>

      {value.repeatEnabled && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
          <AppInput
            label="Repeat every (days)"
            type="number"
            min={1}
            max={365}
            value={value.repeatIntervalDays}
            onChange={(e) => set({ repeatIntervalDays: e.target.value })}
            hint="Uses this campaign’s timezone for the time of day"
          />
          <AppInput
            label="Stop after date (optional)"
            type="datetime-local"
            value={value.repeatUntil}
            min={minUntil}
            onChange={(e) => set({ repeatUntil: e.target.value })}
          />
          <AppInput
            label="Stop after this many sends (optional)"
            type="number"
            min={1}
            max={500}
            value={value.repeatMaxOccurrences}
            onChange={(e) => set({ repeatMaxOccurrences: e.target.value })}
            hint="Includes the first send"
          />
        </div>
      )}
    </div>
  );
}
