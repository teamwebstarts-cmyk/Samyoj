import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

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

const INTERVAL_PRESETS = [
  { days: '2', label: '2 days' },
  { days: '7', label: 'Weekly' },
  { days: '30', label: 'Monthly' },
];

interface CampaignRepeatFieldsProps {
  value: CampaignRepeatValues;
  onChange: (next: CampaignRepeatValues) => void;
  minUntil?: string;
  /** Kept for callers; the compact layout is now the default. */
  compact?: boolean;
}

export default function CampaignRepeatFields({
  value,
  onChange,
  minUntil,
}: CampaignRepeatFieldsProps) {
  const [limitsOpen, setLimitsOpen] = useState(
    Boolean(value.repeatUntil || value.repeatMaxOccurrences),
  );
  const set = (patch: Partial<CampaignRepeatValues>) => onChange({ ...value, ...patch });
  const presetSelected = INTERVAL_PRESETS.some((preset) => preset.days === value.repeatIntervalDays);

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40">
        <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">Repeat this campaign</span>
        <input
          type="checkbox"
          checked={value.repeatEnabled}
          onChange={(event) => set({ repeatEnabled: event.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30"
        />
      </label>

      {value.repeatEnabled && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[10px] font-bold text-slate-500">Every</span>
            {INTERVAL_PRESETS.map((preset) => {
              const active = value.repeatIntervalDays === preset.days;
              return (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => set({ repeatIntervalDays: preset.days })}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold transition ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
            <label
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-extrabold ${
                presetSelected
                  ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              <input
                aria-label="Custom repeat interval in days"
                type="number"
                min={1}
                max={365}
                value={presetSelected ? '' : value.repeatIntervalDays}
                placeholder="—"
                onChange={(event) => set({ repeatIntervalDays: event.target.value || '2' })}
                className={`h-4 w-8 bg-transparent text-center outline-none ${
                  presetSelected ? 'text-slate-700 dark:text-slate-200' : 'text-white placeholder:text-white/70'
                }`}
              />
              days
            </label>
          </div>

          <button
            type="button"
            onClick={() => setLimitsOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-lg px-0.5 py-0.5 text-[10px] font-bold text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {limitsOpen ? 'Hide stop options' : 'Optional stop'}
            <ChevronDown className={`h-3.5 w-3.5 transition ${limitsOpen ? 'rotate-180' : ''}`} />
          </button>

          {limitsOpen && (
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">Stop on</span>
                <input
                  type="date"
                  value={value.repeatUntil.slice(0, 10)}
                  min={minUntil?.slice(0, 10)}
                  onChange={(event) =>
                    set({ repeatUntil: event.target.value ? `${event.target.value}T23:59` : '' })
                  }
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">After sends</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  placeholder="No limit"
                  value={value.repeatMaxOccurrences}
                  onChange={(event) => set({ repeatMaxOccurrences: event.target.value })}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
