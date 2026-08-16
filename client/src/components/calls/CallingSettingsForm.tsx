import { Clock3, MessageSquare, Moon, PhoneMissed, Settings2, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import AppTextarea from '../ui/AppTextarea';
import { CallingSettingsSkeleton } from './CallsPageSkeleton';
import { callingApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';

export interface CallingSettings {
  aiAutoAnswer: boolean;
  aiGreeting: string;
  defaultBotId: string | null;
  routingMode: 'ai_only' | 'agents_first' | 'ai_then_agents';
  agentRingTimeoutSec: number;
  maxConcurrentCalls: number;
  afterHoursMode: 'ai' | 'message' | 'missed';
  afterHoursMessage: string;
  missedCallAutoMessage: boolean;
  missedCallMessage: string;
  recordingConsentEnabled: boolean;
  recordingConsentMessage: string;
  sarvamSttLanguage?: string | null;
  sarvamTtsSpeaker?: string | null;
  sarvamMode?: 'codemix' | 'transcribe';
  sarvamSttPrompt?: string | null;
  liveTransferEnabled?: boolean;
  transferMode?: 'live' | 'message_only';
  maxCallDurationSec?: number;
}

export const DEFAULT_GREETING = 'Hi, thanks for calling. How can I help?';

const defaultSettings: CallingSettings = {
  aiAutoAnswer: true,
  aiGreeting: DEFAULT_GREETING,
  defaultBotId: null,
  routingMode: 'ai_then_agents',
  agentRingTimeoutSec: 25,
  maxConcurrentCalls: 10,
  afterHoursMode: 'ai',
  afterHoursMessage: 'Thanks for calling. We are currently closed.',
  missedCallAutoMessage: true,
  missedCallMessage: 'Sorry we missed your call! Reply here and we will help you shortly.',
  recordingConsentEnabled: false,
  recordingConsentMessage: 'This call may be recorded.',
  liveTransferEnabled: false,
  transferMode: 'message_only',
  sarvamTtsSpeaker: 'shubh',
  sarvamSttLanguage: 'hi-IN',
  sarvamSttPrompt: null,
  maxCallDurationSec: 480,
};

// Top 10 Sarvam voices — officially recommended for multilingual voice agents.
// Source: docs.sarvam.ai → Best Practices → Speaker Selection by Language
// Four multilingual Bulbul voices for the calling bot (2 male + 2 female).
// Keep SARVAM_SPEAKERS as the full catalog; the bot UI only shows this set.
export const CALLING_BOT_SPEAKERS = [
  { value: 'shubh', label: 'Shubh', hint: 'Male · Hindi and more', gender: 'male' as const },
  { value: 'ratan', label: 'Ratan', hint: 'Male · English and more', gender: 'male' as const },
  { value: 'priya', label: 'Priya', hint: 'Female · Hindi and more', gender: 'female' as const },
  { value: 'ishita', label: 'Ishita', hint: 'Female · English and more', gender: 'female' as const },
];

export const SARVAM_SPEAKERS = [
  { value: 'shubh', label: 'Shubh', hint: 'Male · Best for Hindi, Telugu, Kannada, Odia', gender: 'male' },
  { value: 'ratan', label: 'Ratan', hint: 'Male · Best for English, Tamil, Marathi, Gujarati', gender: 'male' },
  { value: 'ashutosh', label: 'Ashutosh', hint: 'Male · Hindi specialist, clear & precise', gender: 'male' },
  { value: 'rohan', label: 'Rohan', hint: 'Male · Tamil specialist, confident & bold', gender: 'male' },
  { value: 'mani', label: 'Mani', hint: 'Male · Best overall male, Punjabi expert', gender: 'male' },
  { value: 'priya', label: 'Priya', hint: 'Female · Best for Hindi, Marathi, Gujarati, Telugu', gender: 'female' },
  { value: 'ishita', label: 'Ishita', hint: 'Female · Best for English, Tamil, Kannada', gender: 'female' },
  { value: 'suhani', label: 'Suhani', hint: 'Female · Hindi, Bengali, Punjabi — sweet & soft', gender: 'female' },
  { value: 'neha', label: 'Neha', hint: 'Female · Telugu, Kannada — clear & friendly', gender: 'female' },
  { value: 'ritu', label: 'Ritu', hint: 'Female · Tamil, Marathi, Gujarati — professional', gender: 'female' },
];

export const SARVAM_LANGUAGES = [
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'en-IN', label: 'English (India)' },
  { value: 'unknown', label: 'Auto-detect' },
];

const RING_PRESETS = [20, 30, 45, 60];

type SectionId = 'behavior' | 'recording' | 'after-hours' | 'missed' | 'advanced';

const SECTIONS: Array<{
  id: SectionId;
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'behavior', label: 'Call behavior', icon: Settings2 },
  { id: 'recording', label: 'Recording', icon: MessageSquare },
  { id: 'after-hours', label: 'After hours', icon: Moon },
  { id: 'missed', label: 'Missed call reply', icon: PhoneMissed },
  { id: 'advanced', label: 'Advanced', icon: Clock3 },
];

interface CallingSettingsFormProps {
  initialSection?: SectionId;
}

export default function CallingSettingsForm({ initialSection = 'behavior' }: CallingSettingsFormProps) {
  const [section, setSection] = useState<SectionId>(initialSection);
  const [settings, setSettings] = useState<CallingSettings>(defaultSettings);
  const [baseline, setBaseline] = useState<CallingSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callingApi
      .settings()
      .then((settingsRes) => {
        const next = {
          ...defaultSettings,
          ...settingsRes.data.data,
          liveTransferEnabled: false,
          transferMode: 'message_only' as const,
        };
        setSettings(next);
        setBaseline(next);
      })
      .catch(() => toastError('Could not load calling settings.'))
      .finally(() => setLoading(false));
  }, []);

  const telephonyPayload = useMemo(
    () => ({
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
    }),
    [settings]
  );

  const dirty = useMemo(() => {
    const base = {
      agentRingTimeoutSec: baseline.agentRingTimeoutSec,
      maxConcurrentCalls: baseline.maxConcurrentCalls,
      afterHoursMode: baseline.afterHoursMode,
      afterHoursMessage: baseline.afterHoursMessage,
      missedCallAutoMessage: baseline.missedCallAutoMessage,
      missedCallMessage: baseline.missedCallMessage,
      recordingConsentEnabled: baseline.recordingConsentEnabled,
      recordingConsentMessage: baseline.recordingConsentMessage,
      liveTransferEnabled: false,
      transferMode: 'message_only' as const,
    };
    return JSON.stringify(telephonyPayload) !== JSON.stringify(base);
  }, [baseline, telephonyPayload]);

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await callingApi.updateSettings(telephonyPayload);
      const payload = data.data as CallingSettings & { warning?: string };
      const { warning, ...rest } = payload;
      const next = {
        ...defaultSettings,
        ...rest,
        liveTransferEnabled: false,
        transferMode: 'message_only' as const,
      };
      setSettings(next);
      setBaseline(next);
      if (warning) {
        toastSuccess(warning);
      } else {
        toastSuccess('Calling settings saved.');
      }
    } catch {
      toastError('Could not save calling settings.');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!window.confirm('Reset calling settings to defaults? Unsaved edits will be lost.')) return;
    setSettings(defaultSettings);
  }

  function handleCancel() {
    setSettings(baseline);
  }

  if (loading) return <CallingSettingsSkeleton />;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* Section nav */}
          <nav className="flex shrink-0 gap-1 overflow-x-auto lg:h-full lg:w-[210px] lg:flex-col lg:gap-1.5 lg:overflow-visible">
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`inline-flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition-all lg:gap-3 lg:px-3.5 lg:py-3 lg:text-[15px] ${
                    active
                      ? 'bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800'
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-200'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 lg:h-[21px] lg:w-[21px]" strokeWidth={2} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Main + how it works */}
          <div className="min-w-0 flex-1 space-y-4">
            <p className="text-[12px] font-medium text-theme-muted">
              Greeting, speaker, and which bot answers the phone live on{' '}
              <span className="font-semibold text-theme-fg">AI Bots → Calling</span>. This screen is
              for ring, recording, and missed-call follow-up.
            </p>
            {section === 'behavior' && (
              <SectionFrame
                title="Call behavior"
                subtitle="Control what happens during and after the call."
              >
                <BehaviorRow
                  label="Ring team for"
                  hint="Recommended 20–40s"
                  control={
                    <AppSelect
                      value={String(
                        RING_PRESETS.includes(settings.agentRingTimeoutSec)
                          ? settings.agentRingTimeoutSec
                          : settings.agentRingTimeoutSec
                      )}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          agentRingTimeoutSec: parseInt(e.target.value, 10) || 30,
                        }))
                      }
                      options={[
                        ...RING_PRESETS.map((s) => ({ value: String(s), label: `${s} seconds` })),
                        ...(!RING_PRESETS.includes(settings.agentRingTimeoutSec)
                          ? [
                              {
                                value: String(settings.agentRingTimeoutSec),
                                label: `${settings.agentRingTimeoutSec} seconds`,
                              },
                            ]
                          : []),
                      ]}
                    />
                  }
                />
                <BehaviorRow
                  label="When caller asks for a person"
                  hint="The team is notified on WhatsApp. Live voice transfer is not available."
                  control={
                    <AppSelect
                      value="message"
                      disabled
                      onChange={() => {
                        /* Message-only handoff — live transfer is not available */
                      }}
                      options={[{ value: 'message', label: 'Message on WhatsApp' }]}
                    />
                  }
                />
                <p className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 text-[12px] font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
                  Max calls at once is under Advanced. Recording consent is under Recording.
                </p>
              </SectionFrame>
            )}

            {section === 'recording' && (
              <SectionFrame
                title="Recording"
                subtitle="Ask for consent before the call is recorded."
              >
                <label className="flex items-center gap-2 text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">
                  <input
                    type="checkbox"
                    checked={settings.recordingConsentEnabled}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, recordingConsentEnabled: e.target.checked }))
                    }
                    className="rounded border-neutral-300"
                  />
                  Play recording consent at call start
                </label>
                {settings.recordingConsentEnabled && (
                  <AppTextarea
                    className="mt-2"
                    label="Consent message"
                    value={settings.recordingConsentMessage}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, recordingConsentMessage: e.target.value }))
                    }
                    rows={2}
                  />
                )}
              </SectionFrame>
            )}

            {section === 'after-hours' && (
              <SectionFrame title="When you’re closed" subtitle="What happens outside business hours.">
                <AppSelect
                  label="After hours"
                  value={settings.afterHoursMode}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      afterHoursMode: e.target.value as CallingSettings['afterHoursMode'],
                    }))
                  }
                  options={[
                    { value: 'ai', label: 'AI still answers' },
                    { value: 'message', label: 'Play message & hang up' },
                    { value: 'missed', label: 'Mark as missed' },
                  ]}
                />
                <AppTextarea
                  className="mt-3"
                  label="After-hours message"
                  value={settings.afterHoursMessage}
                  onChange={(e) => setSettings((s) => ({ ...s, afterHoursMessage: e.target.value }))}
                  rows={3}
                />
              </SectionFrame>
            )}

            {section === 'missed' && (
              <SectionFrame title="If nobody answers" subtitle="Follow up on WhatsApp after a missed call.">
                <label className="flex items-center gap-2 text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">
                  <input
                    type="checkbox"
                    checked={settings.missedCallAutoMessage}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, missedCallAutoMessage: e.target.checked }))
                    }
                    className="rounded border-neutral-300"
                  />
                  Auto-send WhatsApp message on missed calls
                </label>
                <AppTextarea
                  className="mt-3"
                  label="Missed call message"
                  value={settings.missedCallMessage}
                  onChange={(e) => setSettings((s) => ({ ...s, missedCallMessage: e.target.value }))}
                  rows={3}
                />
              </SectionFrame>
            )}

            {section === 'advanced' && (
              <SectionFrame title="Advanced" subtitle="Power knobs — leave defaults if unsure.">
                <AppInput
                  label="Max calls at once"
                  type="number"
                  min={1}
                  max={100}
                  value={String(settings.maxConcurrentCalls)}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      maxConcurrentCalls: parseInt(e.target.value, 10) || 10,
                    }))
                  }
                />
                <AppInput
                  className="mt-3"
                  label="Custom ring timeout (seconds)"
                  type="number"
                  min={10}
                  max={120}
                  value={String(settings.agentRingTimeoutSec)}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      agentRingTimeoutSec: parseInt(e.target.value, 10) || 25,
                    }))
                  }
                />
              </SectionFrame>
            )}
          </div>
        </div>
      </div>

      {/* Footer — sticky within the form container */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200 bg-white px-5 py-3.5 dark:border-neutral-800 dark:bg-neutral-950">
        <button
          type="button"
          onClick={handleReset}
          className="text-[12px] font-medium text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          Reset default
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={!dirty}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[13px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!dirty && !saving}
            onClick={() => void handleSave()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[18px] font-extrabold tracking-tight text-theme-fg">{title}</h3>
      <p className="mt-1.5 text-[13px] font-medium text-theme-muted">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function BehaviorRow({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: string;
  control: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-700 dark:bg-neutral-900">
      <div>
        <p className="text-[13px] font-bold text-theme-fg">{label}</p>
        {hint && <p className="text-[11px] font-medium text-theme-muted">{hint}</p>}
      </div>
      <div className="w-full sm:w-[220px]">{control}</div>
    </div>
  );
}
