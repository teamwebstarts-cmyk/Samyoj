import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateChip(value: string) {
  const date = parseDateKey(value);
  if (!date) return 'Pick a date';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function CampaignSchedulePicker({
  value,
  min,
  onChange,
}: {
  value: string;
  min: string;
  onChange: (value: string) => void;
}) {
  const minDate = parseDateKey(min);
  const selectedDate = parseDateKey(value);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(
    () =>
      new Date(
        (selectedDate || minDate || new Date()).getFullYear(),
        (selectedDate || minDate || new Date()).getMonth(),
        1,
      ),
  );
  const selectedTime = value.slice(11, 16) || min.slice(11, 16) || '09:00';
  const today = startOfDay(new Date());
  const minimumDay = minDate ? startOfDay(minDate) : today;

  const cells = useMemo(() => {
    const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const gridStart = new Date(firstDay.getTime() - firstDay.getDay() * DAY_MS);
    return Array.from({ length: 42 }, (_, index) => new Date(gridStart.getTime() + index * DAY_MS));
  }, [viewMonth]);

  const canGoPrevious =
    viewMonth.getFullYear() > minimumDay.getFullYear() ||
    (viewMonth.getFullYear() === minimumDay.getFullYear() && viewMonth.getMonth() > minimumDay.getMonth());

  const updateDate = (date: Date) => {
    onChange(`${dateKey(date)}T${selectedTime}`);
    setCalendarOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
        <button
          type="button"
          aria-expanded={calendarOpen}
          aria-label="Choose send date"
          onClick={() => setCalendarOpen((open) => !open)}
          className={`inline-flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
            calendarOpen
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35'
              : 'border-slate-200 bg-white hover:border-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-emerald-800'
          }`}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="min-w-0 truncate text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
            {formatDateChip(value)}
          </span>
        </button>
        <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-950">
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <input
            aria-label="Schedule time"
            type="time"
            value={selectedTime}
            min={value.slice(0, 10) === min.slice(0, 10) ? min.slice(11, 16) : undefined}
            onChange={(event) =>
              onChange(`${value.slice(0, 10) || dateKey(minDate || today)}T${event.target.value}`)
            }
            className="h-5 w-[5.5rem] bg-transparent text-[11px] font-extrabold text-slate-800 outline-none dark:text-slate-100"
          />
        </label>
      </div>

      {calendarOpen && (
        <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              disabled={!canGoPrevious}
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-slate-900"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200">{monthLabel(viewMonth)}</p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-px">
            {WEEKDAYS.map((day, index) => (
              <div
                key={`${day}-${index}`}
                className="py-0.5 text-center text-[8px] font-extrabold uppercase text-slate-400"
              >
                {day}
              </div>
            ))}
            {cells.map((date) => {
              const key = dateKey(date);
              const disabled = startOfDay(date).getTime() < minimumDay.getTime();
              const selected = selectedDate ? dateKey(selectedDate) === key : false;
              const isToday = dateKey(today) === key;
              const inMonth = date.getMonth() === viewMonth.getMonth();
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => updateDate(date)}
                  className={[
                    'h-6 rounded-md text-[10px] font-semibold transition',
                    inMonth ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-700',
                    disabled ? 'cursor-not-allowed opacity-30' : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
                    selected ? 'bg-emerald-600 text-white hover:bg-emerald-600' : '',
                    isToday && !selected ? 'ring-1 ring-emerald-200 dark:ring-emerald-800' : '',
                  ].join(' ')}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
