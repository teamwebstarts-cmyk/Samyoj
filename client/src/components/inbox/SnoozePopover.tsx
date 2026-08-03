import { useState } from 'react';
import { AlarmClockCheck, BellOff, CalendarClock, Clock } from 'lucide-react';

interface SnoozePopoverProps {
  snoozedUntil?: string | null;
  onSnooze: (untilIso: string, label: string) => void;
  onUnsnooze: () => void;
  onClose: () => void;
}

interface Preset {
  id: string;
  label: string;
  resolve: () => Date;
}

const PRESETS: Preset[] = [
  { id: '1h', label: '1 hour', resolve: () => new Date(Date.now() + 60 * 60 * 1000) },
  { id: '4h', label: '4 hours', resolve: () => new Date(Date.now() + 4 * 60 * 60 * 1000) },
  {
    id: 'tomorrow',
    label: 'Tomorrow, 9:00 AM',
    resolve: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

function formatUntil(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Snooze duration picker: 1h / 4h / tomorrow 9 AM / custom, plus Unsnooze when already snoozed. */
export default function SnoozePopover({
  snoozedUntil,
  onSnooze,
  onUnsnooze,
  onClose,
}: SnoozePopoverProps) {
  const [customValue, setCustomValue] = useState('');
  const isSnoozed = Boolean(snoozedUntil && new Date(snoozedUntil).getTime() > Date.now());

  const pick = (preset: Preset) => {
    onSnooze(preset.resolve().toISOString(), preset.label);
    onClose();
  };

  const submitCustom = () => {
    if (!customValue) return;
    const date = new Date(customValue);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return;
    onSnooze(date.toISOString(), `until ${formatUntil(date.toISOString())}`);
    onClose();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close snooze picker"
        className="fixed inset-0 z-30 cursor-default"
        onClick={onClose}
      />
      <div className="absolute right-0 top-full z-40 mt-1.5 w-[240px] overflow-hidden rounded-xl border border-theme-border bg-theme-surface py-1.5 shadow-panel">
        <p className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wide text-theme-muted">
          Snooze until
        </p>

        {isSnoozed && snoozedUntil && (
          <button
            type="button"
            onClick={() => {
              onUnsnooze();
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-semibold text-indigo-700 transition hover:bg-theme-subtle dark:text-indigo-300"
          >
            <BellOff className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              Unsnooze
              <span className="block truncate text-[10.5px] font-medium text-theme-muted">
                Snoozed until {formatUntil(snoozedUntil)}
              </span>
            </span>
          </button>
        )}

        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => pick(preset)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle"
          >
            <Clock className="h-4 w-4 shrink-0 text-theme-muted" />
            {preset.label}
          </button>
        ))}

        <div className="mt-1 border-t border-theme-border/60 px-3 pb-1 pt-2">
          <label className="flex items-center gap-2 text-[12px] font-semibold text-theme-secondary">
            <CalendarClock className="h-4 w-4 shrink-0 text-theme-muted" />
            Custom
          </label>
          <div className="mt-1.5 flex items-center gap-1.5">
            <input
              type="datetime-local"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-[12px] text-theme-fg focus:border-whatsapp-500/50 focus:outline-none"
            />
            <button
              type="button"
              disabled={!customValue}
              onClick={submitCustom}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40"
              aria-label="Snooze until custom time"
            >
              <AlarmClockCheck className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
