import { useState } from 'react';
import { Clock, MessageSquare, Moon } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import CannedRepliesPanel from './CannedRepliesPanel';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHour(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour === 12) return '12:00 PM';
  if (hour === 24) return '12:00 AM (Next Day)';
  if (hour > 12) return `${hour - 12}:00 PM`;
  return `${hour}:00 AM`;
}

interface HoursAndInboxPanelProps {
  businessHours: {
    startHour: number;
    endHour: number;
    days: number[];
    timezone?: string;
  };
  onSaveBusinessHours: (hours: {
    startHour: number;
    endHour: number;
    days: number[];
  }) => Promise<void>;
  savingHours: boolean;
  canEdit: boolean;
}

export default function HoursAndInboxPanel({
  businessHours,
  onSaveBusinessHours,
  savingHours,
  canEdit,
}: HoursAndInboxPanelProps) {
  const [localHours, setLocalHours] = useState(businessHours);

  const toggleDay = (dayIndex: number) => {
    if (!canEdit) return;
    setLocalHours((prev) => {
      const exists = prev.days.includes(dayIndex);
      const nextDays = exists
        ? prev.days.filter((d) => d !== dayIndex)
        : [...prev.days, dayIndex].sort();
      return { ...prev, days: nextDays };
    });
  };

  const handleSave = async () => {
    await onSaveBusinessHours(localHours);
  };

  return (
    <div className="space-y-6">
      {/* Business Hours Panel */}
      <SettingsPanel
        title="Business Operating Hours"
        description="Define your team's active schedule for away messages and automated response routing."
        icon={Clock}
        accent="amber"
        footer={
          canEdit ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-[12px] font-medium text-theme-muted">
                Off-hours messages trigger automated away notices or AI Bot responses.
              </p>
              <AppButton loading={savingHours} onClick={handleSave}>
                Save operating hours
              </AppButton>
            </div>
          ) : undefined
        }
      >
        <div className="mb-5 overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50/80 via-white to-orange-50/40 dark:border-amber-900/40 dark:from-amber-950/30 dark:via-theme-surface dark:to-orange-950/10">
          <div className="h-0.5 bg-gradient-to-r from-amber-500 to-orange-500" />
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-[14px] font-extrabold text-amber-900 dark:text-amber-200">
                {formatHour(localHours.startHour)} – {formatHour(localHours.endHour)}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-amber-800/80 dark:text-amber-300/80">
                {localHours.days.length} active day{localHours.days.length === 1 ? '' : 's'} per week
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-100/80 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
              <Moon className="h-3 w-3" />
              Away Auto-Routing
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <AppInput
            label="Open at (24-hour)"
            type="number"
            min={0}
            max={23}
            value={String(localHours.startHour)}
            onChange={(e) =>
              setLocalHours((prev) => ({ ...prev, startHour: Number(e.target.value) }))
            }
            disabled={!canEdit}
          />
          <AppInput
            label="Close at (24-hour)"
            type="number"
            min={1}
            max={24}
            value={String(localHours.endHour)}
            onChange={(e) =>
              setLocalHours((prev) => ({ ...prev, endHour: Number(e.target.value) }))
            }
            disabled={!canEdit}
          />
        </div>

        <div className="mt-5">
          <p className="mb-3 text-[13px] font-semibold text-theme-fg">Working days</p>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, index) => {
              const selected = localHours.days.includes(index);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(index)}
                  disabled={!canEdit}
                  className={`min-w-[3.5rem] rounded-xl px-3.5 py-2.5 text-[12px] font-bold transition ${
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
      </SettingsPanel>

      {/* Canned Quick Replies */}
      <SettingsPanel
        title="Canned Quick Replies (/shortcuts)"
        description="Create standard response templates that agents can instantly trigger inside the Inbox using /"
        icon={MessageSquare}
        accent="violet"
      >
        <CannedRepliesPanel />
      </SettingsPanel>
    </div>
  );
}
