import { useEffect, useMemo, useState } from 'react';
import { Moon, PhoneMissed, PhoneOff, Users } from 'lucide-react';
import AppTextarea from '../ui/AppTextarea';
import AppButton from '../ui/AppButton';
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
  recordingConsentEnabled: boolean;
  recordingConsentMessage: string;
};

const RING_PRESETS = [20, 30, 45, 60];

const AFTER_HOURS: Array<{ value: AfterHoursMode; label: string; hint: string }> = [
  { value: 'ai', label: 'AI still answers', hint: 'Only if All calls is on' },
  { value: 'message', label: 'Play a message', hint: 'Then hang up' },
  { value: 'missed', label: 'Mark missed', hint: 'No pickup' },
];

const defaults: PickupSettings = {
  agentRingTimeoutSec: 25,
  maxConcurrentCalls: 10,
  afterHoursMode: 'ai',
  afterHoursMessage: 'Thanks for calling. We are currently closed.',
  missedCallAutoMessage: true,
  missedCallMessage: 'Sorry we missed your call! Reply here and we will help you shortly.',
  recordingConsentEnabled: false,
  recordingConsentMessage: 'This call may be recorded.',
};

function telephonyPayload(settings: PickupSettings) {
  return {
    agentRingTimeoutSec: settings.agentRingTimeoutSec,
    maxConcurrentCalls: settings.maxConcurrentCalls,
    afterHoursMode: settings.afterHoursMode,
    afterHoursMessage: settings.afterHoursMessage,
    missedCallAutoMessage: settings.missedCallAutoMessage,
    missedCallMessage: settings.missedCallMessage,
    recordingConsentEnabled: settings.recordingConsentEnabled,
    recordingConsentMessage: settings.recordingConsentMessage,
    liveTransferEnabled: false,
    transferMode: 'message_only' as const,
  };
}

function outcomeLine(settings: PickupSettings): string {
  const ring = `Team has ${settings.agentRingTimeoutSec}s to pick up`;
  const closed =
    settings.afterHoursMode === 'ai'
      ? 'after hours the AI can still answer'
      : settings.afterHoursMode === 'message'
        ? 'after hours we play a message and hang up'
        : 'after hours the call is missed';
  const missed = settings.missedCallAutoMessage
    ? 'a WhatsApp note goes out if nobody answers'
    : 'no auto WhatsApp if the call is missed';
  return `${ring}. When you are closed, ${closed}. ${missed.charAt(0).toUpperCase()}${missed.slice(1)}.`;
}

/** Org telephony for a calling bot. Writes CallingSettings — not a second brain. */
export default function AiBotPickupPanel() {
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
      .catch(() => toastError('Could not load how calls are picked up.'))
      .finally(() => setLoading(false));
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(telephonyPayload(settings)) !== JSON.stringify(telephonyPayload(baseline)),
    [settings, baseline]
  );

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await callingApi.updateSettings(telephonyPayload(settings));
      const payload = data.data as PickupSettings & { warning?: string };
      const { warning, ...rest } = payload;
      const next: PickupSettings = { ...defaults, ...rest };
      setSettings(next);
      setBaseline(next);
      toastSuccess(warning || 'Call pickup saved');
    } catch {
      toastError('Could not save call pickup');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CallingSettingsSkeleton />;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-bold text-theme-fg">When they call</p>
        <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
          For this WhatsApp number. Greeting and voice stay on Setup.
        </p>
      </div>

      <p className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-3.5 py-3 text-[12.5px] font-medium leading-relaxed text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-100">
        {outcomeLine(settings)}
      </p>

      <section className="rounded-2xl border border-theme-border bg-theme-surface p-3.5">
        <div className="flex items-start gap-2.5">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-theme-muted" strokeWidth={2.25} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-theme-fg">Ring the team</p>
            <p className="mt-0.5 text-[11px] text-theme-muted">How long a person has to pick up.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {RING_PRESETS.map((sec) => {
                const selected = settings.agentRingTimeoutSec === sec;
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, agentRingTimeoutSec: sec }))}
                    className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-bold ${
                      selected
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-100'
                        : 'border-theme-border bg-theme-subtle text-theme-secondary hover:border-theme-border-strong'
                    }`}
                  >
                    {sec}s
                  </button>
                );
              })}
            </div>
            <label className="mt-3 flex items-center justify-between gap-3 text-[12px] font-semibold text-theme-secondary">
              Max calls at once
              <input
                type="number"
                min={1}
                max={100}
                value={settings.maxConcurrentCalls}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    maxConcurrentCalls: parseInt(e.target.value, 10) || 10,
                  }))
                }
                className="h-9 w-20 rounded-lg border border-theme-border bg-theme-subtle px-2 text-right text-[13px] font-bold text-theme-fg"
              />
            </label>
            <p className="mt-2 text-[11px] text-theme-muted">
              If they ask for a person, the team is notified on WhatsApp. Live voice transfer is not
              available.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-theme-border bg-theme-surface p-3.5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={settings.recordingConsentEnabled}
            onChange={(e) =>
              setSettings((s) => ({ ...s, recordingConsentEnabled: e.target.checked }))
            }
            className="mt-1 h-4 w-4 rounded border-theme-border text-whatsapp-600 focus:ring-whatsapp-500/25"
          />
          <span>
            <span className="block text-[13px] font-bold text-theme-fg">Recording consent</span>
            <span className="mt-0.5 block text-[11px] text-theme-muted">
              Play a short line before the call is recorded.
            </span>
          </span>
        </label>
        {settings.recordingConsentEnabled && (
          <AppTextarea
            className="mt-3"
            label="Consent line"
            rows={2}
            value={settings.recordingConsentMessage}
            onChange={(e) =>
              setSettings((s) => ({ ...s, recordingConsentMessage: e.target.value }))
            }
          />
        )}
      </section>

      <section className="rounded-2xl border border-theme-border bg-theme-surface p-3.5">
        <div className="flex items-start gap-2.5">
          <Moon className="mt-0.5 h-4 w-4 shrink-0 text-theme-muted" strokeWidth={2.25} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-theme-fg">When you are closed</p>
            <p className="mt-0.5 text-[11px] text-theme-muted">Uses business hours from Settings.</p>
            <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {AFTER_HOURS.map((option) => {
                const selected = settings.afterHoursMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, afterHoursMode: option.value }))}
                    className={`rounded-xl border px-2.5 py-2 text-left ${
                      selected
                        ? 'border-emerald-400 bg-emerald-50/80 dark:border-emerald-600 dark:bg-emerald-950/40'
                        : 'border-theme-border bg-theme-subtle'
                    }`}
                  >
                    <p className="text-[12px] font-bold text-theme-fg">{option.label}</p>
                    <p className="mt-0.5 text-[10px] text-theme-muted">{option.hint}</p>
                  </button>
                );
              })}
            </div>
            <AppTextarea
              className="mt-3"
              label="Closed-hours message"
              rows={2}
              value={settings.afterHoursMessage}
              onChange={(e) => setSettings((s) => ({ ...s, afterHoursMessage: e.target.value }))}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-theme-border bg-theme-surface p-3.5">
        <div className="flex items-start gap-2.5">
          <PhoneMissed className="mt-0.5 h-4 w-4 shrink-0 text-theme-muted" strokeWidth={2.25} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-theme-fg">If nobody answers</p>
            <label className="mt-2 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={settings.missedCallAutoMessage}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, missedCallAutoMessage: e.target.checked }))
                }
                className="mt-1 h-4 w-4 rounded border-theme-border text-whatsapp-600 focus:ring-whatsapp-500/25"
              />
              <span className="text-[12px] font-semibold text-theme-secondary">
                Send a WhatsApp note after a missed call
              </span>
            </label>
            <AppTextarea
              className="mt-3"
              label="Missed-call message"
              rows={2}
              value={settings.missedCallMessage}
              onChange={(e) => setSettings((s) => ({ ...s, missedCallMessage: e.target.value }))}
            />
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-theme-muted">
              <PhoneOff className="h-3.5 w-3.5" strokeWidth={2.25} />
              All calls off means ring a person, then miss — AI does not pick up.
            </p>
          </div>
        </div>
      </section>

      <AppButton type="button" loading={saving} disabled={!dirty && !saving} onClick={() => void save()}>
        Save pickup
      </AppButton>
    </div>
  );
}
