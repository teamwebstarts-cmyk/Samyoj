import { PhoneCall } from 'lucide-react';
import { useEffect, useState } from 'react';
import SettingsPanel from '../settings/SettingsPanel';
import SettingsStat from '../settings/SettingsStat';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import AppTextarea from '../ui/AppTextarea';
import { aiBotApi, callingApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';

interface CallingSettings {
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
}

const defaultSettings: CallingSettings = {
  aiAutoAnswer: true,
  aiGreeting: 'Hello! Thank you for calling. How can I help you today?',
  defaultBotId: null,
  routingMode: 'ai_then_agents',
  agentRingTimeoutSec: 25,
  maxConcurrentCalls: 10,
  afterHoursMode: 'ai',
  afterHoursMessage: 'Thanks for calling. We are currently closed.',
  missedCallAutoMessage: true,
  missedCallMessage: 'Sorry we missed your call! Reply here and we will help you shortly.',
  recordingConsentEnabled: false,
  recordingConsentMessage: 'This call may be recorded for quality purposes.',
};

export default function CallingSettingsPanel() {
  const [settings, setSettings] = useState<CallingSettings>(defaultSettings);
  const [bots, setBots] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([callingApi.settings(), aiBotApi.list()])
      .then(([settingsRes, botsRes]) => {
        setSettings({ ...defaultSettings, ...settingsRes.data.data });
        const botPayload = botsRes.data.data as { bots?: Array<{ id: string; name: string }> };
        setBots(Array.isArray(botPayload?.bots) ? botPayload.bots : []);
      })
      .catch(() => toastError('Could not load calling settings.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await callingApi.updateSettings(settings as unknown as Record<string, unknown>);
      setSettings({ ...defaultSettings, ...data.data });
      toastSuccess('Calling settings saved.');
    } catch {
      toastError('Could not save calling settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <SettingsPanel
      title="Voice calling"
      description="AI auto-answer, agent routing, after-hours behavior, and missed-call follow-ups."
      icon={PhoneCall}
      accent="violet"
      footer={
        <AppButton loading={saving} onClick={() => void handleSave()}>
          Save calling settings
        </AppButton>
      }
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <SettingsStat
          label="Routing"
          value={settings.routingMode.replace(/_/g, ' ')}
          tone="text-violet-700 dark:text-violet-400"
        />
        <SettingsStat
          label="Ring timeout"
          value={`${settings.agentRingTimeoutSec}s`}
          tone="text-emerald-700 dark:text-emerald-400"
        />
        <SettingsStat
          label="Max concurrent"
          value={settings.maxConcurrentCalls}
          tone="text-sky-700 dark:text-sky-400"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-[13px] font-semibold text-neutral-800">
          <input
            type="checkbox"
            checked={settings.aiAutoAnswer}
            onChange={(e) => setSettings((s) => ({ ...s, aiAutoAnswer: e.target.checked }))}
            className="rounded border-neutral-300"
          />
          AI auto-answer enabled
        </label>

        <AppSelect
          label="Routing mode"
          value={settings.routingMode}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              routingMode: e.target.value as CallingSettings['routingMode'],
            }))
          }
          options={[
            { value: 'ai_then_agents', label: 'AI first (default)' },
            { value: 'agents_first', label: 'Agents first, AI fallback' },
            { value: 'ai_only', label: 'AI only' },
          ]}
        />

        <AppSelect
          label="Default AI bot"
          value={settings.defaultBotId || ''}
          onChange={(e) =>
            setSettings((s) => ({ ...s, defaultBotId: e.target.value || null }))
          }
          options={[
            { value: '', label: 'Use conversation default' },
            ...bots.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />

        <AppInput
          label="Agent ring timeout (sec)"
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
          label="Max concurrent calls"
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
      </div>

      <AppTextarea
        label="AI greeting"
        value={settings.aiGreeting}
        onChange={(e) => setSettings((s) => ({ ...s, aiGreeting: e.target.value }))}
        rows={2}
        className="mt-4"
      />

      <AppTextarea
        label="After-hours message"
        value={settings.afterHoursMessage}
        onChange={(e) => setSettings((s) => ({ ...s, afterHoursMessage: e.target.value }))}
        rows={2}
        className="mt-4"
      />

      <label className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-neutral-800">
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
        label="Missed call message"
        value={settings.missedCallMessage}
        onChange={(e) => setSettings((s) => ({ ...s, missedCallMessage: e.target.value }))}
        rows={2}
        className="mt-2"
      />

      <label className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-neutral-800">
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

      <AppTextarea
        label="Recording consent message"
        value={settings.recordingConsentMessage}
        onChange={(e) =>
          setSettings((s) => ({ ...s, recordingConsentMessage: e.target.value }))
        }
        rows={2}
        className="mt-2"
      />
    </SettingsPanel>
  );
}
