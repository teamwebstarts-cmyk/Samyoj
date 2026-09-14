import { useEffect, useMemo, useState } from 'react';
import { Clock, Moon } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import AppButton from '../ui/AppButton';
import AppSelect from '../ui/AppSelect';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface BusinessHoursShape {
  startHour: number;
  endHour: number;
  days: number[];
  timezone?: string;
  awayMessageEnabled?: boolean;
  awayMessage?: string;
}

interface HoursAndInboxPanelProps {
  businessHours: BusinessHoursShape;
  onSaveBusinessHours: (hours: BusinessHoursShape) => Promise<void>;
  savingHours: boolean;
  canEdit: boolean;
}

function hourLabel(hour: number): string {
  if (hour >= 24) return 'Midnight';
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${suffix}`;
}

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, h) => ({
  value: String(h),
  label: hourLabel(h),
}));

const PRESETS = [
  { id: 'weekdays', label: 'Weekdays', hint: 'Mon–Fri 9–6', startHour: 9, endHour: 18, days: [1, 2, 3, 4, 5] },
  { id: 'extended', label: 'Extended', hint: 'Mon–Sat 8–10', startHour: 8, endHour: 22, days: [1, 2, 3, 4, 5, 6] },
  {
    id: 'always',
    label: '24×7',
    hint: 'Always open',
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
  return sorted.map((d) => DAY_FULL[d]).join(', ');
}

function timezoneLabel(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'long',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timezone;
  } catch {
    return timezone;
  }
}

function resolveTimezone(tz?: string): string {
  if (tz && tz !== 'UTC') return tz;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

function nowInOrg(timezone: string): { hour: number; dayIndex: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hourCycle: 'h23',
      weekday: 'short',
    }).formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === 'hour')?.value;
    const dayPart = parts.find((p) => p.type === 'weekday')?.value;
    if (!hourPart || !dayPart) return null;
    return { hour: parseInt(hourPart, 10) % 24, dayIndex: DAY_FULL.indexOf(dayPart) };
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
  const resolvedTz = resolveTimezone(businessHours.timezone);
  const [localHours, setLocalHours] = useState<BusinessHoursShape>({
    ...businessHours,
    timezone: resolvedTz,
  });
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    const tz = resolveTimezone(businessHours.timezone);
    setLocalHours({ ...businessHours, timezone: tz });
    setCustomOpen(detectPresetId({ ...businessHours, timezone: tz }) === 'custom');
  }, [businessHours]);

  const dirty =
    localHours.startHour !== businessHours.startHour ||
    localHours.endHour !== businessHours.endHour ||
    !sameDays(localHours.days, businessHours.days) ||
    resolveTimezone(localHours.timezone) !== resolveTimezone(businessHours.timezone) ||
    Boolean(localHours.awayMessageEnabled) !== Boolean(businessHours.awayMessageEnabled) ||
    (localHours.awayMessage ?? '') !== (businessHours.awayMessage ?? '');

  const presetId = detectPresetId(localHours);
  const isAlwaysOpen = localHours.startHour === 0 && localHours.endHour === 24 && localHours.days.length === 7;

  const applyPreset = (id: string) => {
    if (!canEdit) return;
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setLocalHours({
      ...localHours,
      startHour: preset.startHour,
      endHour: preset.endHour,
      days: [...preset.days],
    });
    setCustomOpen(false);
  };

  const setOpenHour = (value: number) => {
    if (!canEdit) return;
    setLocalHours((prev) => {
      const startHour = Math.max(0, Math.min(23, value));
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
    setCustomOpen(true);
  };

  const handleSave = async () => {
    await onSaveBusinessHours({
      startHour: localHours.startHour,
      endHour: localHours.endHour,
      days: localHours.days,
      timezone: localHours.timezone,
      awayMessageEnabled: localHours.awayMessageEnabled,
      awayMessage: localHours.awayMessage,
    });
  };

  const tz = localHours.timezone || resolvedTz;
  const now = nowInOrg(tz);
  const openNow = Boolean(
    now &&
      localHours.days.includes(now.dayIndex) &&
      now.hour >= localHours.startHour &&
      now.hour < localHours.endHour
  );

  const summaryLine = useMemo(() => {
    if (localHours.days.length === 0) return 'No days selected';
    if (isAlwaysOpen) return 'Open all day, every day';
    return `${daysLabel(localHours.days)} · ${hourLabel(localHours.startHour)} – ${hourLabel(localHours.endHour)}`;
  }, [localHours.days, localHours.startHour, localHours.endHour, isAlwaysOpen]);

  return (
    <SettingsPanel
      title="Business hours"
      description="Away replies run outside these hours."
      icon={Clock}
      footer={
        canEdit ? (
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-[12px] text-theme-muted">
              {dirty ? (
                <span className="font-semibold text-whatsapp-700 dark:text-whatsapp-400">Unsaved changes</span>
              ) : (
                timezoneLabel(tz)
              )}
            </p>
            <AppButton loading={savingHours} onClick={handleSave} disabled={!dirty} size="sm">
              Save hours
            </AppButton>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {/* Summary row */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-whatsapp-500/15 bg-gradient-to-r from-whatsapp-500/[0.06] to-emerald-500/[0.03] px-4 py-3">
          <p className="min-w-0 truncate text-[13px] font-bold text-theme-fg">{summaryLine}</p>
          {now && (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                openNow
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                  : 'bg-theme-subtle text-theme-secondary ring-1 ring-theme-border'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${openNow ? 'bg-emerald-500' : 'bg-theme-muted'}`} />
              {openNow ? 'Open' : 'Closed'}
            </span>
          )}
        </div>

        {/* Presets */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {PRESETS.map((preset) => {
            const selected = presetId === preset.id && !customOpen;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                disabled={!canEdit}
                className={`rounded-xl px-3 py-3 text-center transition disabled:cursor-not-allowed ${
                  selected
                    ? 'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white'
                    : 'bg-theme-subtle text-theme-fg ring-1 ring-theme-border hover:bg-whatsapp-500/5'
                }`}
              >
                <p className="text-[12px] font-bold leading-tight">{preset.label}</p>
                <p className={`mt-1 text-[10px] font-medium ${selected ? 'text-white/80' : 'text-theme-muted'}`}>
                  {preset.hint}
                </p>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          className="block pt-1 text-[11px] font-semibold text-whatsapp-700 hover:underline dark:text-whatsapp-400"
        >
          {customOpen ? 'Hide details' : 'Customize'}
        </button>

        {customOpen && (
          <div className="space-y-4 rounded-xl border border-theme-border/80 bg-theme-subtle/25 p-4">
            {!isAlwaysOpen && (
              <div className="grid grid-cols-2 gap-3">
                <AppSelect
                  id="hours-open"
                  label="Opens"
                  value={String(localHours.startHour)}
                  onChange={(e) => setOpenHour(parseInt(e.target.value, 10))}
                  options={HOUR_OPTIONS}
                  disabled={!canEdit}
                />
                <AppSelect
                  id="hours-close"
                  label="Closes"
                  value={String(Math.min(localHours.endHour, 24))}
                  onChange={(e) => setCloseHour(parseInt(e.target.value, 10))}
                  options={HOUR_OPTIONS}
                  disabled={!canEdit}
                />
              </div>
            )}

            <div>
              <p className="mb-2 text-[11px] font-semibold text-theme-fg">Open on</p>
              <div className="flex justify-between gap-2">
                {DAY_LABELS.map((label, index) => {
                  const selected = localHours.days.includes(index);
                  return (
                    <button
                      key={`${label}-${index}`}
                      type="button"
                      onClick={() => toggleDay(index)}
                      disabled={!canEdit}
                      aria-pressed={selected}
                      aria-label={DAY_FULL[index]}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${
                        selected
                          ? 'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white'
                          : 'bg-theme-surface text-theme-muted ring-1 ring-theme-border'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Out-of-office away auto-reply */}
        <div className="rounded-xl border border-theme-border/80 bg-theme-subtle/25 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-whatsapp-500/10 text-whatsapp-600 dark:text-whatsapp-400">
                <Moon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-theme-fg">Out-of-office away auto-reply</p>
                <p className="text-[11px] text-theme-muted">
                  Automatically respond to customers when messages arrive outside operating hours
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(localHours.awayMessageEnabled)}
              disabled={!canEdit}
              onClick={() =>
                setLocalHours((prev) => ({
                  ...prev,
                  awayMessageEnabled: !prev.awayMessageEnabled,
                  awayMessage:
                    prev.awayMessage ||
                    'Thanks for reaching out! We are currently closed. Our team will get back to you during business hours.',
                }))
              }
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-whatsapp-500 focus:ring-offset-2 ${
                localHours.awayMessageEnabled ? 'bg-whatsapp-500' : 'bg-theme-border'
              } ${!canEdit ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  localHours.awayMessageEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {localHours.awayMessageEnabled && (
            <div className="pt-2 border-t border-theme-border/50 space-y-1.5">
              <label htmlFor="away-reply-text" className="block text-[11px] font-semibold text-theme-fg">
                Auto-reply message
              </label>
              <textarea
                id="away-reply-text"
                rows={3}
                maxLength={1000}
                disabled={!canEdit}
                value={localHours.awayMessage ?? ''}
                onChange={(e) => setLocalHours((prev) => ({ ...prev, awayMessage: e.target.value }))}
                placeholder="Thanks for reaching out! We are currently closed. Our team will get back to you during business hours."
                className="w-full rounded-xl border border-theme-border bg-theme-surface px-3 py-2 text-[12px] text-theme-fg shadow-sm placeholder:text-theme-muted focus:border-whatsapp-500 focus:outline-none focus:ring-1 focus:ring-whatsapp-500 disabled:opacity-60 disabled:cursor-not-allowed resize-none transition"
              />
              <div className="flex items-center justify-between text-[11px] text-theme-muted">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  Anti-spam rate limit: Max 1 away reply per 12 hours per chat.
                </span>
                <span>{(localHours.awayMessage ?? '').length}/1000</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </SettingsPanel>
  );
}
