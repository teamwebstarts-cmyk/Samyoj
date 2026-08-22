import { useEffect, useMemo, useState } from 'react';
import { Clock, Moon } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import AppButton from '../ui/AppButton';
import AppSelect from '../ui/AppSelect';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

interface BusinessHoursShape {
  startHour: number;
  endHour: number;
  days: number[];
  timezone?: string;
}

interface HoursAndInboxPanelProps {
  businessHours: BusinessHoursShape;
  onSaveBusinessHours: (hours: {
    startHour: number;
    endHour: number;
    days: number[];
  }) => Promise<void>;
  savingHours: boolean;
  canEdit: boolean;
}

function hourLabel(hour: number): string {
  if (hour >= 24) return '12:00 AM (next day)';
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${suffix}`;
}

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, h) => ({
  value: String(h),
  label: hourLabel(h),
}));

const PRESETS = [
  { id: 'weekdays', label: 'Weekdays · 9 to 6', startHour: 9, endHour: 18, days: [1, 2, 3, 4, 5] },
  { id: 'extended', label: 'Extended · 8 to 10', startHour: 8, endHour: 22, days: [1, 2, 3, 4, 5, 6] },
  {
    id: 'always',
    label: 'Always open · 24×7',
    startHour: 0,
    endHour: 24,
    days: [0, 1, 2, 3, 4, 5, 6],
  },
] as const;

function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');
}

function detectPresetId(hours: BusinessHoursShape): string {
  const preset = PRESETS.find(
    (p) => p.startHour === hours.startHour && p.endHour === hours.endHour && sameDays([...p.days], hours.days)
  );
  return preset?.id ?? 'custom';
}

function daysLabel(days: number[]): string {
  if (days.length === 7) return 'Every day';
  const sorted = [...days].sort((a, b) => a - b);
  if (sameDays(sorted, [1, 2, 3, 4, 5])) return 'Mon–Fri';
  if (sameDays(sorted, [1, 2, 3, 4, 5, 6])) return 'Mon–Sat';
  return sorted.map((d) => DAY_LABELS[d]).join(', ');
}

/** Current wall-clock hour + weekday in the org timezone (falls back on bad tz). */
function nowInOrg(timezone?: string): { hour: number; dayIndex: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || DEFAULT_TIMEZONE,
      hour: 'numeric',
      hourCycle: 'h23',
      weekday: 'short',
    }).formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === 'hour')?.value;
    const dayPart = parts.find((p) => p.type === 'weekday')?.value;
    if (!hourPart || !dayPart) return null;
    return { hour: parseInt(hourPart, 10) % 24, dayIndex: DAY_LABELS.indexOf(dayPart) };
  } catch {
    return null;
  }
}

export default function HoursAndInboxPanel({
  businessHours,
  onSaveBusinessHours,
  savingHours,
  canEdit,
}: HoursAndInboxPanelProps) {
  const [localHours, setLocalHours] = useState<BusinessHoursShape>(businessHours);

  // Re-sync the draft when fresh hours arrive from the server.
  useEffect(() => {
    setLocalHours(businessHours);
  }, [businessHours]);

  const dirty =
    localHours.startHour !== businessHours.startHour ||
    localHours.endHour !== businessHours.endHour ||
    !sameDays(localHours.days, businessHours.days);

  const presetId = detectPresetId(localHours);

  const applyPreset = (id: string) => {
    if (!canEdit) return;
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setLocalHours({ ...localHours, startHour: preset.startHour, endHour: preset.endHour, days: [...preset.days] });
  };

  const setOpenHour = (value: number) => {
    if (!canEdit) return;
    setLocalHours((prev) => {
      const startHour = Math.max(0, Math.min(23, value));
      // Keep opens-before-closes valid automatically.
      const endHour = prev.endHour <= startHour ? Math.min(startHour + 1, 24) : prev.endHour;
      return { ...prev, startHour, endHour };
    });
  };

  const setCloseHour = (value: number) => {
    if (!canEdit) return;
    setLocalHours((prev) => {
      const endHour = Math.max(1, Math.min(24, value));
      const startHour = prev.startHour >= endHour ? Math.max(endHour - 1, 0) : prev.startHour;
      return { ...prev, startHour, endHour };
    });
  };

  const toggleDay = (dayIndex: number) => {
    if (!canEdit) return;
    setLocalHours((prev) => {
      const exists = prev.days.includes(dayIndex);
      const nextDays = exists
        ? prev.days.filter((d) => d !== dayIndex)
        : [...prev.days, dayIndex].sort((a, b) => a - b);
      return { ...prev, days: nextDays };
    });
  };

  const handleSave = async () => {
    await onSaveBusinessHours({
      startHour: localHours.startHour,
      endHour: localHours.endHour,
      days: localHours.days,
    });
  };

  const summaryDays = daysLabel(localHours.days);
  const now = nowInOrg(localHours.timezone);
  const openNow = Boolean(
    now &&
      localHours.days.includes(now.dayIndex) &&
      now.hour >= localHours.startHour &&
      now.hour < localHours.endHour
  );

  const summaryLine = useMemo(
    () =>
      localHours.days.length === 0
        ? 'No working days selected'
        : `${summaryDays} · ${hourLabel(localHours.startHour)} – ${hourLabel(localHours.endHour)}`,
    [summaryDays, localHours.startHour, localHours.endHour, localHours.days.length]
  );

  return (
    <div className="space-y-5">
      <SettingsPanel
        title="Business hours"
        description="When your team is open. Outside these hours, away replies run."
        icon={Clock}
        accent="amber"
        footer={
          canEdit ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-[12px] font-medium text-theme-muted">
                {dirty ? (
                  <span className="font-semibold text-amber-600 dark:text-amber-400">Unsaved changes</span>
                ) : (
                  'Off-hours chats get your away reply.'
                )}
              </p>
              <AppButton loading={savingHours} onClick={handleSave} disabled={!dirty}>
                Save hours
              </AppButton>
            </div>
          ) : undefined
        }
      >
        {/* Quick presets */}
        <div>
          <p className="mb-2 text-[13px] font-semibold text-theme-fg">Quick pick</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                disabled={!canEdit}
                className={`rounded-full px-3.5 py-2 text-[12px] font-bold transition disabled:cursor-not-allowed ${
                  presetId === preset.id
                    ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_4px_12px_rgba(245,158,11,0.28)]'
                    : 'bg-theme-subtle text-theme-secondary ring-1 ring-theme-border hover:bg-theme-surface hover:text-theme-fg disabled:hover:bg-theme-subtle'
                }`}
              >
                {preset.label}
              </button>
            ))}
            {presetId === 'custom' && (
              <span className="inline-flex items-center rounded-full bg-violet-50 px-3.5 py-2 text-[12px] font-bold text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/60">
                Custom schedule
              </span>
            )}
          </div>
        </div>

        {/* Open / close times */}
        <div className="grid gap-4 pt-2 sm:grid-cols-2">
          <AppSelect
            id="hours-open"
            label="Opens at"
            value={String(localHours.startHour)}
            onChange={(e) => setOpenHour(parseInt(e.target.value, 10))}
            options={HOUR_OPTIONS}
            disabled={!canEdit}
          />
          <AppSelect
            id="hours-close"
            label="Closes at"
            value={String(Math.min(localHours.endHour, 24))}
            onChange={(e) => setCloseHour(parseInt(e.target.value, 10))}
            options={HOUR_OPTIONS}
            disabled={!canEdit}
          />
        </div>

        {/* Working days */}
        <div className="pt-2">
          <p className="mb-2 text-[13px] font-semibold text-theme-fg">Working days</p>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, index) => {
              const selected = localHours.days.includes(index);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(index)}
                  disabled={!canEdit}
                  aria-pressed={selected}
                  className={`min-w-[3.25rem] rounded-xl px-3 py-2 text-[12px] font-bold transition ${
                    selected
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_4px_12px_rgba(245,158,11,0.28)]'
                      : 'bg-theme-subtle text-theme-muted ring-1 ring-theme-border hover:bg-theme-surface hover:text-theme-secondary'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live summary */}
        <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50/80 via-white to-orange-50/40 px-4 py-3.5 dark:border-amber-900/40 dark:from-amber-950/30 dark:via-theme-surface dark:to-orange-950/10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[14px] font-extrabold text-amber-900 dark:text-amber-200">{summaryLine}</p>
            <p className="mt-0.5 text-[11px] font-medium text-amber-800/80 dark:text-amber-300/80">
              Times shown in {DEFAULT_TIMEZONE === (localHours.timezone || DEFAULT_TIMEZONE) ? 'Indian Standard Time' : localHours.timezone}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {now && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                  openNow
                    ? 'bg-emerald-100/90 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                    : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${openNow ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                {openNow ? 'Open now' : 'Closed now'}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100/80 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
              <Moon className="h-3 w-3" />
              Away replies after hours
            </span>
          </div>
        </div>
      </SettingsPanel>
    </div>
  );
}
