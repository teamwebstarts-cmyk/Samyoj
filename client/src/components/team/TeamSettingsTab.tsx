import { useEffect, useState } from 'react';
import { GitBranch, Users, Zap } from 'lucide-react';
import AppSelect from '../ui/AppSelect';
import LoadingState from '../ui/LoadingState';
import ProgressBar from '../ui/ProgressBar';
import SectionCard from '../ui/SectionCard';
import { teamApi } from '../../services/api';
import type { TeamSettings } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';

interface TeamSettingsTabProps {
  canManage: boolean;
}

export default function TeamSettingsTab({ canManage }: TeamSettingsTabProps) {
  const [settings, setSettings] = useState<TeamSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    teamApi.settings
      .get()
      .then(({ data }) => setSettings(data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const update = async (patch: Partial<TeamSettings>) => {
    if (!canManage || !settings) return;
    setSaving(true);
    try {
      const { data } = await teamApi.settings.update(patch);
      setSettings({ ...settings, ...data.data });
      toastSuccess('Settings saved');
    } catch {
      toastError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) return <LoadingState label="Loading team settings..." />;

  const seatPct = Math.min(100, Math.round((settings.seatsUsed / settings.seatLimit) * 100));

  return (
    <div className="inbox-shell overflow-hidden p-4 sm:p-5">
      <div className="space-y-5">
      <SectionCard title="Seat usage" subtitle={`${settings.plan} plan`}>
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-extrabold tabular-nums text-theme-fg">
              {settings.seatsUsed}
              <span className="text-base font-semibold text-theme-muted"> / {settings.seatLimit}</span>
            </p>
            <ProgressBar
              className="mt-3"
              value={settings.seatsUsed}
              max={settings.seatLimit}
              label="Seats used"
              showPercent
            />
            {seatPct >= 90 && (
              <p className="mt-2 text-[12px] font-medium text-rose-600 dark:text-rose-400">
                You're close to your seat limit. Upgrade your plan to add more teammates.
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Assignment rules" subtitle="How chats are routed to agents">
        <div className="grid gap-5 lg:grid-cols-2">
          <AppSelect
            id="assignment-strategy"
            label="Assignment strategy"
            value={settings.assignmentStrategy}
            isSearchable={false}
            disabled={!canManage || saving}
            options={[
              { value: 'LEAST_LOAD', label: 'Least load — fewest open chats first' },
              { value: 'ROUND_ROBIN', label: 'Round robin — rotate evenly' },
            ]}
            onChange={(e) =>
              update({ assignmentStrategy: e.target.value as TeamSettings['assignmentStrategy'] })
            }
          />
          <div className="space-y-3">
            <ToggleRow
              icon={Zap}
              label="Online agents only"
              description="Skip offline and away agents during handoff"
              checked={settings.handoffOnlyOnline}
              disabled={!canManage || saving}
              onChange={(v) => update({ handoffOnlyOnline: v })}
            />
            <ToggleRow
              icon={GitBranch}
              label="Respect shift schedules"
              description="Only assign to agents within working hours"
              checked={settings.respectShiftSchedule}
              disabled={!canManage || saving}
              onChange={(v) => update({ respectShiftSchedule: v })}
            />
          </div>
        </div>
      </SectionCard>
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: typeof Zap;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
        checked
          ? 'border-whatsapp-500/30 bg-whatsapp-500/[0.04]'
          : 'border-theme-border/60 bg-theme-subtle/20 hover:bg-theme-subtle/40'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-whatsapp-500/10 text-whatsapp-600">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-theme-fg">{label}</p>
        <p className="mt-0.5 text-[11px] text-theme-secondary">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-theme-border text-whatsapp-600 focus:ring-whatsapp-500/25"
      />
    </label>
  );
}
