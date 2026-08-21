import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import AppButton from '../ui/AppButton';

export interface DateRangeSelection {
  presetKey: string;
  label: string;
  from?: string;
  to?: string;
  compare?: boolean;
}

interface ReportsDateRangePickerProps {
  selection: DateRangeSelection;
  onChange: (next: DateRangeSelection) => void;
}

const PRESETS = [
  { key: 'today', label: 'Today', days: 1 },
  { key: 'yesterday', label: 'Yesterday', days: 1 },
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '14d', label: 'Last 14 days', days: 14 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: 'mtd', label: 'This month (MTD)' },
  { key: 'last_month', label: 'Last month' },
  { key: '90d', label: 'Last 90 days', days: 90 },
] as const;

export default function ReportsDateRangePicker({
  selection,
  onChange,
}: ReportsDateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(selection.presetKey === 'custom');
  const [customFrom, setCustomFrom] = useState(selection.from || '');
  const [customTo, setCustomTo] = useState(selection.to || '');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelectPreset = (p: (typeof PRESETS)[number]) => {
    setCustomMode(false);
    setOpen(false);
    onChange({
      presetKey: p.key,
      label: p.label,
      compare: selection.compare,
    });
  };

  const handleApplyCustom = () => {
    if (!customFrom || !customTo) return;
    setOpen(false);
    onChange({
      presetKey: 'custom',
      label: `${customFrom} to ${customTo}`,
      from: customFrom,
      to: customTo,
      compare: selection.compare,
    });
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-xl border border-theme-border bg-theme-surface px-3 py-1.5 text-[13px] font-semibold text-theme-fg shadow-sm transition hover:border-whatsapp-500/40 hover:bg-theme-subtle focus:outline-none focus:ring-2 focus:ring-whatsapp-500/30"
      >
        <Calendar className="h-4 w-4 text-theme-muted" />
        <span className="truncate">{selection.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-theme-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-2xl border border-theme-border bg-theme-surface p-2 shadow-panel backdrop-blur-xl animate-fade-down dark:bg-slate-900/95">
          <div className="p-1">
            <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-theme-muted">
              Select time period
            </p>
            <div className="grid grid-cols-2 gap-1">
              {PRESETS.map((preset) => {
                const active = selection.presetKey === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition ${
                      active
                        ? 'bg-whatsapp-50 text-whatsapp-800 font-semibold ring-1 ring-whatsapp-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800/40'
                        : 'text-theme-fg hover:bg-theme-subtle'
                    }`}
                  >
                    <span className="truncate">{preset.label}</span>
                    {active && <Check className="h-3 w-3 shrink-0 text-whatsapp-600 dark:text-emerald-400" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 border-t border-theme-border pt-2">
              <button
                type="button"
                onClick={() => setCustomMode((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-theme-secondary hover:bg-theme-subtle"
              >
                <span>Custom date range...</span>
                <span className="text-[10px] text-theme-muted">{customMode ? 'Hide' : 'Show'}</span>
              </button>

              {customMode && (
                <div className="mt-2 space-y-2 rounded-xl bg-theme-subtle/50 p-2 text-[12px]">
                  <div>
                    <label className="block text-[10px] font-semibold text-theme-muted">Start Date</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1 text-[12px] text-theme-fg focus:outline-none focus:ring-1 focus:ring-whatsapp-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-theme-muted">End Date</label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1 text-[12px] text-theme-fg focus:outline-none focus:ring-1 focus:ring-whatsapp-500"
                    />
                  </div>
                  <AppButton
                    size="sm"
                    className="w-full justify-center"
                    disabled={!customFrom || !customTo}
                    onClick={handleApplyCustom}
                  >
                    Apply custom range
                  </AppButton>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
