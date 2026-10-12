import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import AppTextarea from '../ui/AppTextarea';
import { CallingSettingsSkeleton } from '../calls/CallsPageSkeleton';
import { callingApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';

type AfterHoursMode = 'ai' | 'message' | 'missed';

type PickupSettings = {
  agentRingTimeoutSec: number;
  maxConcurrentCalls: number;
  afterHoursMode: AfterHoursMode;
  afterHoursMessage: string;
  missedCallAutoMessage: boolean;
  missedCallMessage: string;
};

const RING_PRESETS = [20, 30, 45, 60];

const AFTER_HOURS: Array<{ value: AfterHoursMode; label: string }> = [
  { value: 'ai', label: 'AI answers' },
  { value: 'message', label: 'Play message' },
  { value: 'missed', label: 'Missed' },
];

const defaults: PickupSettings = {
  agentRingTimeoutSec: 25,
  maxConcurrentCalls: 10,
  afterHoursMode: 'ai',
  afterHoursMessage: 'Thanks for calling. We are currently closed.',
  missedCallAutoMessage: true,
  missedCallMessage: 'Sorry we missed your call! Reply here and we will help you shortly.',
};

function telephonyPayload(settings: PickupSettings) {
  return {
    agentRingTimeoutSec: settings.agentRingTimeoutSec,
    maxConcurrentCalls: settings.maxConcurrentCalls,
    afterHoursMode: settings.afterHoursMode,
    afterHoursMessage: settings.afterHoursMessage,
    missedCallAutoMessage: settings.missedCallAutoMessage,
    missedCallMessage: settings.missedCallMessage,
    liveTransferEnabled: false,
    transferMode: 'message_only' as const,
  };
}

export type AiBotPickupPanelHandle = {
  save: () => Promise<boolean>;
  dirty: boolean;
  saving: boolean;
};

type AiBotPickupPanelProps = {
  onStateChange?: (state: { dirty: boolean; saving: boolean }) => void;
};

function ChipRow<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-bold transition ${
              selected
                ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-100'
                : 'border-theme-border bg-theme-subtle text-theme-secondary hover:border-theme-border-strong'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-theme-border bg-theme-surface px-3.5 py-3">
      <span className="text-[13px] font-semibold text-theme-fg">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-theme-border text-whatsapp-600 focus:ring-whatsapp-500/25"
      />
    </label>
  );
}

/** Org telephony for a calling bot. Writes CallingSettings — not a second brain. */
const AiBotPickupPanel = forwardRef<AiBotPickupPanelHandle, AiBotPickupPanelProps>(
  function AiBotPickupPanel({ onStateChange }, ref) {
    const [settings, setSettings] = useState<PickupSettings>(defaults);
    const [baseline, setBaseline] = useState<PickupSettings>(defaults);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      callingApi
        .settings()
        .then((res) => {
          const data = res.data.data as Partial<PickupSettings>;
          const next: PickupSettings = {
            ...defaults,
            ...data,
            afterHoursMode: (data.afterHoursMode as AfterHoursMode) || defaults.afterHoursMode,
          };
          setSettings(next);
          setBaseline(next);
        })
        .catch(() => toastError('Could not load call settings'))
        .finally(() => setLoading(false));
    }, []);

    const dirty = useMemo(
      () => JSON.stringify(telephonyPayload(settings)) !== JSON.stringify(telephonyPayload(baseline)),
      [settings, baseline]
    );

    const ringOptions = useMemo(() => {
      const sec = settings.agentRingTimeoutSec;
      const values = RING_PRESETS.includes(sec) ? RING_PRESETS : [...RING_PRESETS, sec].sort((a, b) => a - b);
      return values.map((value) => ({ value, label: `${value}s` }));
    }, [settings.agentRingTimeoutSec]);

    useEffect(() => {
      onStateChange?.({ dirty, saving });
    }, [dirty, saving, onStateChange]);

    const save = async (): Promise<boolean> => {
      if (!dirty) return true;
      setSaving(true);
      try {
        const { data } = await callingApi.updateSettings(telephonyPayload(settings));
        const payload = data.data as PickupSettings & { warning?: string };
        const { warning, ...rest } = payload;
        const next: PickupSettings = { ...defaults, ...rest };
        setSettings(next);
        setBaseline(next);
        toastSuccess(warning || 'Saved');
        return true;
      } catch {
        toastError('Could not save');
        return false;
      } finally {
        setSaving(false);
      }
    };

    useImperativeHandle(ref, () => ({ save, dirty, saving }), [dirty, saving, settings]);

    if (loading) return <CallingSettingsSkeleton />;

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-theme-border bg-theme-surface p-4 space-y-4">
          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-theme-fg">Team rings for</p>
            <ChipRow
              options={ringOptions}
              value={settings.agentRingTimeoutSec}
              onChange={(sec) => setSettings((s) => ({ ...s, agentRingTimeoutSec: sec }))}
            />
          </div>

          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-theme-fg">After hours</p>
            <ChipRow
              options={AFTER_HOURS}
              value={settings.afterHoursMode}
              onChange={(mode) => setSettings((s) => ({ ...s, afterHoursMode: mode }))}
            />
            {settings.afterHoursMode === 'message' && (
              <AppTextarea
                rows={2}
                placeholder="Closed-hours message"
                value={settings.afterHoursMessage}
                onChange={(e) => setSettings((s) => ({ ...s, afterHoursMessage: e.target.value }))}
              />
            )}
          </div>
        </div>

        <ToggleRow
          label="WhatsApp if missed"
          checked={settings.missedCallAutoMessage}
          onChange={(checked) => setSettings((s) => ({ ...s, missedCallAutoMessage: checked }))}
        />
        {settings.missedCallAutoMessage && (
          <AppTextarea
            rows={2}
            placeholder="Missed-call message"
            value={settings.missedCallMessage}
            onChange={(e) => setSettings((s) => ({ ...s, missedCallMessage: e.target.value }))}
          />
        )}

      </div>
    );
  }
);

export default AiBotPickupPanel;
