import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import AppButton from '../ui/AppButton';
import {
  METRICS_PRESET_OPTIONS,
  addDays,
  formatMetricsPeriodLabel,
  metricsPeriodsEqual,
  parseIsoDate,
  startOfDay,
  toIsoDate,
  type MetricsPeriod,
} from '../../utils/metricsPeriod';

const MENU_GAP = 6;
const MENU_MAX_WIDTH = 448;

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBetween(date: Date, from: Date | null, to: Date | null) {
  if (!from || !to) return false;
  const start = from.getTime() <= to.getTime() ? from : to;
  const end = from.getTime() <= to.getTime() ? to : from;
  const time = startOfDay(date).getTime();
  return time >= startOfDay(start).getTime() && time <= startOfDay(end).getTime();
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function RangeCalendar({
  draftFrom,
  draftTo,
  onSelectDay,
  viewMonth,
  onViewMonthChange,
}: {
  draftFrom: string | null;
  draftTo: string | null;
  onSelectDay: (iso: string) => void;
  viewMonth: Date;
  onViewMonthChange: (next: Date) => void;
}) {
  const today = startOfDay(new Date());
  const fromDate = draftFrom ? parseIsoDate(draftFrom) : null;
  const toDate = draftTo ? parseIsoDate(draftTo) : null;

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const gridStart = addDays(firstDay, -startOffset);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [viewMonth]);

  const canGoNext =
    viewMonth.getFullYear() < today.getFullYear() ||
    (viewMonth.getFullYear() === today.getFullYear() && viewMonth.getMonth() < today.getMonth());

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => onViewMonthChange(addDays(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1), -1))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-[13px] font-bold text-neutral-900">{monthLabel(viewMonth)}</p>
        <button
          type="button"
          aria-label="Next month"
          disabled={!canGoNext}
          onClick={() => onViewMonthChange(addDays(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1), 0))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-1 text-center text-[10px] font-extrabold uppercase tracking-[0.08em] text-neutral-400"
          >
            {day}
          </div>
        ))}
        {cells.map((date) => {
          const iso = toIsoDate(date);
          const inMonth = date.getMonth() === viewMonth.getMonth();
          const isFuture = startOfDay(date).getTime() > today.getTime();
          const isStart = fromDate ? isSameDay(date, fromDate) : false;
          const isEnd = toDate ? isSameDay(date, toDate) : false;
          const inRange = isBetween(date, fromDate, toDate);
          const isToday = isSameDay(date, today);

          return (
            <button
              key={iso}
              type="button"
              disabled={isFuture}
              onClick={() => onSelectDay(iso)}
              className={[
                'relative h-9 rounded-lg text-[12px] font-semibold transition',
                !inMonth ? 'text-neutral-300' : 'text-neutral-800',
                isFuture ? 'cursor-not-allowed opacity-35' : 'hover:bg-emerald-50',
                inRange && !isStart && !isEnd ? 'bg-emerald-50/80 text-emerald-900' : '',
                isStart || isEnd
                  ? 'bg-emerald-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)] hover:bg-emerald-600'
                  : '',
                isToday && !isStart && !isEnd ? 'ring-1 ring-emerald-200' : '',
              ].join(' ')}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function MetricsPeriodPicker({
  period,
  onPeriodChange,
  align = 'left',
}: {
  period: MetricsPeriod;
  onPeriodChange?: (period: MetricsPeriod) => void;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => startOfDay(new Date()));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const label = formatMetricsPeriodLabel(period);

  const placeMenu = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(MENU_MAX_WIDTH, window.innerWidth - 24);
    let left = align === 'right' ? rect.right - width : rect.left;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    setMenuPos({
      top: rect.bottom + MENU_GAP,
      left,
      width,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    placeMenu();
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    return () => {
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    if (period.kind === 'custom') {
      setDraftFrom(period.from);
      setDraftTo(period.to);
      const anchor = parseIsoDate(period.to) ?? new Date();
      setViewMonth(startOfDay(anchor));
      return;
    }
    const today = startOfDay(new Date());
    setDraftFrom(toIsoDate(addDays(today, -6)));
    setDraftTo(toIsoDate(today));
    setViewMonth(today);
  }, [open, period]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selectPreset = (next: MetricsPeriod) => {
    onPeriodChange?.(next);
    setOpen(false);
  };

  const handleSelectDay = (iso: string) => {
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(iso);
      setDraftTo(null);
      return;
    }
    const from = parseIsoDate(draftFrom);
    const clicked = parseIsoDate(iso);
    if (!from || !clicked) return;
    if (clicked.getTime() < from.getTime()) {
      setDraftTo(draftFrom);
      setDraftFrom(iso);
      return;
    }
    setDraftTo(iso);
  };

  const applyCustomRange = () => {
    if (!draftFrom || !draftTo || !onPeriodChange) return;
    onPeriodChange({ kind: 'custom', from: draftFrom, to: draftTo });
    setOpen(false);
  };

  const customDraftLabel =
    draftFrom && draftTo
      ? formatMetricsPeriodLabel({ kind: 'custom', from: draftFrom, to: draftTo })
      : draftFrom
        ? `${formatMetricsPeriodLabel({ kind: 'custom', from: draftFrom, to: draftFrom })} → pick end`
        : 'Select a start date';

  if (!onPeriodChange) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 shadow-xs">
        <Calendar className="h-3.5 w-3.5 text-neutral-400 stroke-[2]" aria-hidden />
        {label}
      </span>
    );
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Metrics period"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex max-w-[min(100vw-2rem,16rem)] items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 shadow-xs transition-colors hover:border-neutral-300 hover:bg-white"
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 text-neutral-400 stroke-[2]" aria-hidden />
        <span className="truncate">{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              role="dialog"
              aria-label="Choose metrics period"
              style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
              className="fixed z-[250] overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.14)]"
            >
              <div className="grid sm:grid-cols-[11.5rem_minmax(0,1fr)]">
                <div className="border-b border-neutral-100 bg-neutral-50/70 p-2 sm:border-b-0 sm:border-r">
                  <p className="px-2 pb-1 pt-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-neutral-500">
                    Quick ranges
                  </p>
                  {METRICS_PRESET_OPTIONS.map((option) => {
                    const candidate: MetricsPeriod = { kind: 'preset', days: option.days };
                    const active = metricsPeriodsEqual(period, candidate);
                    return (
                      <button
                        key={option.days}
                        type="button"
                        onClick={() => selectPreset(candidate)}
                        className={`mt-0.5 flex w-full items-center rounded-xl px-3 py-2 text-left text-[12px] font-semibold transition ${
                          active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'text-neutral-700 hover:bg-white'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => selectPreset({ kind: 'overall' })}
                    className={`mt-0.5 flex w-full items-center rounded-xl px-3 py-2 text-left text-[12px] font-semibold transition ${
                      period.kind === 'overall'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'text-neutral-700 hover:bg-white'
                    }`}
                  >
                    All time
                  </button>
                </div>

                <div className="p-3 sm:p-3.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-neutral-500">
                    Custom range
                  </p>
                  <div className="mt-2">
                    <RangeCalendar
                      draftFrom={draftFrom}
                      draftTo={draftTo}
                      onSelectDay={handleSelectDay}
                      viewMonth={viewMonth}
                      onViewMonthChange={setViewMonth}
                    />
                  </div>
                  <p className="mt-3 text-[11px] font-medium text-neutral-500">{customDraftLabel}</p>
                  <AppButton
                    type="button"
                    size="sm"
                    className="mt-3 w-full"
                    disabled={!draftFrom || !draftTo}
                    onClick={applyCustomRange}
                  >
                    Apply range
                  </AppButton>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export { MetricsPeriodPicker as PeriodPicker };
export {
  METRICS_PRESET_OPTIONS as LIVE_METRICS_PERIOD_OPTIONS,
  type MetricsPresetDays as LiveMetricsPeriodDays,
} from '../../utils/metricsPeriod';
