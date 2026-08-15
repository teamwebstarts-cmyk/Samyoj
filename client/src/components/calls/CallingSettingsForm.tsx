import {
  Bot,
  Clock3,
  Link as LinkIcon,
  MessageSquare,
  Moon,
  PhoneCall,
  PhoneMissed,
  Play,
  Settings2,
  Sparkles,
  User,
  Volume2,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import AppTextarea from '../ui/AppTextarea';
import { CallingSettingsSkeleton } from './CallsPageSkeleton';
import { aiBotApi, callingApi } from '../../services/api';
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

type SectionId =
  | 'who'
  | 'behavior'
  | 'greetings'
  | 'after-hours'
  | 'missed'
  | 'voice'
  | 'personality'
  | 'training'
  | 'advanced';

const SECTIONS: Array<{
  id: SectionId;
  label: string;
  icon: typeof Bot;
  deepLink?: boolean;
}> = [
  { id: 'who', label: 'Who answers', icon: PhoneCall },
  { id: 'behavior', label: 'Call behavior', icon: Settings2 },
  { id: 'greetings', label: 'Greetings', icon: MessageSquare },
  { id: 'after-hours', label: 'After hours', icon: Moon },
  { id: 'missed', label: 'Missed call reply', icon: PhoneMissed },
  { id: 'voice', label: 'Voice & language', icon: Volume2 },
  { id: 'personality', label: 'AI Bot personality', icon: Sparkles, deepLink: true },
  { id: 'training', label: 'Training data', icon: Bot, deepLink: true },
  { id: 'advanced', label: 'Advanced', icon: Clock3 },
];

function applyWhoAnswers(
  mode: CallingSettings['routingMode']
): Pick<CallingSettings, 'routingMode' | 'aiAutoAnswer'> {
  if (mode === 'ai_only') return { routingMode: 'ai_only', aiAutoAnswer: true };
  if (mode === 'agents_first') return { routingMode: 'agents_first', aiAutoAnswer: false };
  return { routingMode: 'ai_then_agents', aiAutoAnswer: true };
}

interface CallingSettingsFormProps {
  initialSection?: SectionId;
}

export default function CallingSettingsForm({ initialSection = 'who' }: CallingSettingsFormProps) {
  const [section, setSection] = useState<SectionId>(initialSection);
  const [settings, setSettings] = useState<CallingSettings>(defaultSettings);
  const [baseline, setBaseline] = useState<CallingSettings>(defaultSettings);
  const [bots, setBots] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    Promise.all([callingApi.settings(), aiBotApi.list()])
      .then(([settingsRes, botsRes]) => {
        const next = {
          ...defaultSettings,
          ...settingsRes.data.data,
          liveTransferEnabled: false,
          transferMode: 'message_only' as const,
        };
        setSettings(next);
        setBaseline(next);
        const botPayload = botsRes.data.data as { bots?: Array<{ id: string; name: string }> };
        setBots(Array.isArray(botPayload?.bots) ? botPayload.bots : []);
      })
      .catch(() => toastError('Could not load calling settings.'))
      .finally(() => setLoading(false));
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(baseline),
    [settings, baseline]
  );
  const botName = bots.find((b) => b.id === settings.defaultBotId)?.name || 'Samyoj AI';

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await callingApi.updateSettings(
        settings as unknown as Record<string, unknown>
      );
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

  async function handlePreviewVoice(speakerOverride?: string) {
    setPreviewing(true);
    try {
      const { data } = await callingApi.previewVoice({
        text: settings.aiGreeting || DEFAULT_GREETING,
        speaker: speakerOverride || settings.sarvamTtsSpeaker || 'shubh',
        language: settings.sarvamSttLanguage || 'hi-IN',
      });
      const payload = data.data as { audioBase64: string; contentType: string };
      const audio = new Audio(`data:${payload.contentType};base64,${payload.audioBase64}`);
      await audio.play();
    } catch {
      toastError('Could not play preview. Check that Sarvam is configured on the server.');
    } finally {
      setPreviewing(false);
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
            <Link
              to="/calls"
              className="mt-2 hidden rounded-xl border border-dashed border-neutral-200 px-3.5 py-3 text-[12.5px] font-semibold text-neutral-400 hover:border-emerald-200 hover:text-emerald-700 lg:mt-auto lg:block dark:border-neutral-700"
            >
              Setup guide on Calls page
            </Link>
          </nav>

          {/* Main + how it works */}
          <div className="min-w-0 flex-1 space-y-4">
            {section === 'who' && (
              <SectionFrame
                title="Who answers calls"
                subtitle="Choose who should handle incoming WhatsApp calls."
              >
                <div className="space-y-3">
                  <WhoCard
                    selected={settings.routingMode === 'ai_only'}
                    title={`AI Bot (${botName})`}
                    tags={['24/7', 'Instant reply']}
                    recommended
                    icon={Bot}
                    onSelect={() => setSettings((s) => ({ ...s, ...applyWhoAnswers('ai_only') }))}
                  />
                  <WhoCard
                    selected={settings.routingMode === 'agents_first'}
                    title="Human agents"
                    tags={['Personal touch', 'When team online']}
                    icon={User}
                    accent="sky"
                    onSelect={() => setSettings((s) => ({ ...s, ...applyWhoAnswers('agents_first') }))}
                  />
                  <WhoCard
                    selected={settings.routingMode === 'ai_then_agents'}
                    title="AI first, human backup"
                    tags={['Best of both', 'Smart handoff']}
                    icon={Sparkles}
                    accent="amber"
                    description="AI answers first. If you turn on connect-to-person, callers can reach your team."
                    onSelect={() =>
                      setSettings((s) => ({ ...s, ...applyWhoAnswers('ai_then_agents') }))
                    }
                  />
                </div>

                <div className="mt-4 space-y-2">
                  <AppSelect
                    label="Which AI"
                    value={settings.defaultBotId || ''}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, defaultBotId: e.target.value || null }))
                    }
                    options={[
                      { value: '', label: 'Default support bot' },
                      ...bots.map((b) => ({ value: b.id, label: b.name })),
                    ]}
                  />
                  <Link
                    to="/ai-bot"
                    className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-700 hover:text-emerald-800"
                  >
                    <LinkIcon className="h-3 w-3" />
                    Edit personality & training
                  </Link>
                </div>
              </SectionFrame>
            )}

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
                  Max calls at once and recording consent are under Advanced.
                </p>
              </SectionFrame>
            )}

            {section === 'greetings' && (
              <SectionFrame title="Greeting" subtitle="First thing callers hear when AI answers.">
                <AppTextarea
                  label="Greeting message"
                  value={settings.aiGreeting}
                  onChange={(e) => setSettings((s) => ({ ...s, aiGreeting: e.target.value }))}
                  rows={3}
                />
                <div className="mt-2">
                  <AppButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setSettings((s) => ({ ...s, aiGreeting: DEFAULT_GREETING }))}
                  >
                    Reset to default
                  </AppButton>
                </div>
                <label className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">
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

            {section === 'voice' && (
              <SectionFrame
                title="Voice & language"
                subtitle="How your AI sounds on WhatsApp calls (Sarvam Bulbul + Saaras)."
              >
                <AppSelect
                  label="Language"
                  value={settings.sarvamSttLanguage || 'hi-IN'}
                  onChange={(e) => setSettings((s) => ({ ...s, sarvamSttLanguage: e.target.value }))}
                  options={SARVAM_LANGUAGES}
                />
                <p className="mb-2 mt-4 text-[12px] font-bold text-neutral-700 dark:text-neutral-300">
                  Speaker
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {SARVAM_SPEAKERS.map((sp) => {
                    const selected = (settings.sarvamTtsSpeaker || 'shubh') === sp.value;
                    return (
                      <button
                        key={sp.value}
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, sarvamTtsSpeaker: sp.value }))}
                        className={`group relative rounded-2xl border px-3 py-3 text-left transition ${
                          selected
                            ? 'border-emerald-400 bg-emerald-50/80 ring-1 ring-emerald-200 dark:border-emerald-700 dark:bg-emerald-950/40'
                            : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[13px] font-extrabold text-theme-fg">{sp.label}</p>
                            <p className="mt-0.5 text-[11px] font-medium text-theme-muted">{sp.hint}</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handlePreviewVoice(sp.value);
                            }}
                            title={`Preview ${sp.label}`}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 opacity-0 transition group-hover:opacity-100 hover:bg-emerald-100 hover:text-emerald-700 dark:bg-neutral-800 dark:hover:bg-emerald-900/40"
                          >
                            <Play className="h-3 w-3" strokeWidth={2.5} />
                          </button>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <AppTextarea
                  className="mt-4"
                  label="Words Sarvam should recognize"
                  hint="Terminology hint for speech recognition — not bot personality"
                  value={settings.sarvamSttPrompt || ''}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, sarvamSttPrompt: e.target.value || null }))
                  }
                  rows={2}
                  placeholder="e.g. Samyoj, Pune clinic, Diwali offer"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={previewing}
                    onClick={() => void handlePreviewVoice()}
                  >
                    Play greeting preview
                  </AppButton>
                  <p className="text-[11px] font-medium text-theme-muted">
                    Uses your greeting text + selected speaker. Platform Sarvam key — no key in this screen.
                  </p>
                </div>
              </SectionFrame>
            )}

            {section === 'personality' && (
              <DeepLinkCard
                title="Set how your AI speaks"
                body="Personality presets and speaking style live on AI Bots — same brain for chat and voice calls."
                to="/ai-bot"
                cta="Open Personality"
              />
            )}

            {section === 'training' && (
              <DeepLinkCard
                title="Add FAQs and documents"
                body="Train answers once. Your AI uses them on WhatsApp chat and voice calls."
                to="/ai-bot"
                cta="Open Train"
              />
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
                <AppInput
                  className="mt-3"
                  label="Max AI call length (minutes)"
                  type="number"
                  min={2}
                  max={30}
                  value={String(Math.round((settings.maxCallDurationSec ?? 480) / 60))}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      maxCallDurationSec: Math.min(
                        1800,
                        Math.max(120, (parseInt(e.target.value, 10) || 8) * 60)
                      ),
                    }))
                  }
                />
                <p className="mt-1 text-[12px] text-neutral-500">
                  The AI hangs up after this so long calls do not burn credits. Default 8 minutes.
                </p>
                <label className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">
                  <input
                    type="checkbox"
                    checked={settings.aiAutoAnswer}
                    onChange={(e) => setSettings((s) => ({ ...s, aiAutoAnswer: e.target.checked }))}
                    className="rounded border-neutral-300"
                  />
                  AI can answer automatically
                </label>
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

function WhoCard({
  selected,
  title,
  tags,
  recommended,
  description,
  icon: Icon,
  accent = 'emerald',
  onSelect,
}: {
  selected: boolean;
  title: string;
  tags: string[];
  recommended?: boolean;
  description?: string;
  icon: typeof Bot;
  accent?: 'emerald' | 'sky' | 'amber';
  onSelect: () => void;
}) {
  const ring =
    accent === 'sky'
      ? 'border-sky-300 ring-sky-200 dark:border-sky-700'
      : accent === 'amber'
        ? 'border-amber-300 ring-amber-200 dark:border-amber-700'
        : 'border-emerald-400 ring-emerald-200 dark:border-emerald-700';
  const iconBg =
    accent === 'sky'
      ? 'bg-sky-100 text-sky-700'
      : accent === 'amber'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-emerald-100 text-emerald-700';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-5 py-4 text-left transition-all ${
        selected
          ? `${ring} bg-white ring-1 dark:bg-neutral-950`
          : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900'
      }`}
    >
      <div className="flex items-center gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-bold text-theme-fg">{title}</p>
            {recommended && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                Recommended
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1.5 text-[12px] font-medium text-theme-muted">{description}</p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? 'border-emerald-600 bg-emerald-600' : 'border-neutral-300'
          }`}
        />
      </div>
    </button>
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

function DeepLinkCard({
  title,
  body,
  to,
  cta,
}: {
  title: string;
  body: string;
  to: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <h3 className="text-[18px] font-extrabold tracking-tight text-theme-fg">{title}</h3>
      <p className="mt-2 text-[13px] font-medium text-theme-muted">{body}</p>
      <p className="mt-1 text-[12px] font-bold text-emerald-800 dark:text-emerald-300">
        Same AI for chat and calls.
      </p>
      <Link to={to} className="mt-4 inline-block">
        <AppButton size="sm">{cta}</AppButton>
      </Link>
    </div>
  );
}
