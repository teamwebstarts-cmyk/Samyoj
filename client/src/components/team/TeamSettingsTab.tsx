import { useEffect, useState } from 'react';
import { GitBranch, RotateCcw, Shield, Users, Zap } from 'lucide-react';
import AppSelect from '../ui/AppSelect';
import LoadingState from '../ui/LoadingState';
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
    <div className="space-y-5">
      <SectionCard title="Seat usage" subtitle={`Plan: ${settings.plan}`}>
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-extrabold tabular-nums text-theme-fg">
                {settings.seatsUsed}
                <span className="text-lg font-semibold text-theme-muted"> / {settings.seatLimit}</span>
              </p>
              <p className="text-[12px] font-medium text-theme-secondary">Seats used</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-theme-subtle">
            <div
              className={`h-full rounded-full transition-all ${
                seatPct >= 90 ? 'bg-rose-500' : seatPct >= 70 ? 'bg-amber-500' : 'bg-whatsapp-500'
              }`}
              style={{ width: `${seatPct}%` }}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Assignment rules"
        subtitle="How conversations are routed when AI hands off to a human"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
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
          </div>
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
              description="Only assign to agents within their working hours"
              checked={settings.respectShiftSchedule}
              disabled={!canManage || saving}
              onChange={(v) => update({ respectShiftSchedule: v })}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Security" subtitle="Organization-wide security options">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-theme-border/70 bg-theme-subtle/30 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-theme-fg">Two-factor authentication</p>
                <p className="mt-0.5 text-[12px] text-theme-secondary">
                  Each team member can enable TOTP 2FA from their profile or the Security tab.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-dashed border-theme-border/70 bg-theme-subtle/20 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-500/10 text-neutral-500">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-theme-fg">SSO (Coming soon)</p>
                <p className="mt-0.5 text-[12px] text-theme-secondary">
                  Google Workspace and Microsoft Entra ID single sign-on will be available on Business plans.
                </p>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
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
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-theme-border/60 p-3 transition hover:bg-theme-subtle/40">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-whatsapp-500/10 text-whatsapp-600">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-theme-fg">{label}</p>
        <p className="text-[11px] text-theme-secondary">{description}</p>
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
