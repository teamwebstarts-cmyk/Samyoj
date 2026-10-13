import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { config } from '../../config';
import {
  DEFAULT_CALLING_SETTINGS,
  type CallingSettings,
} from './calling-settings.types';

export function mergeCallingSettings(
  stored: Partial<CallingSettings> | null | undefined
): CallingSettings {
  const base: CallingSettings = {
    ...DEFAULT_CALLING_SETTINGS,
    aiAutoAnswer: config.calling.aiAutoAnswer,
    aiGreeting: config.calling.aiGreeting,
  };

  const storedWithoutRecording = stripRecordingSettings(stored);

  if (!storedWithoutRecording) {
    return {
      ...base,
      // Cold live transfer media is not production-ready — always message-only.
      liveTransferEnabled: false,
      transferMode: 'message_only',
    };
  }

  return {
    ...base,
    ...storedWithoutRecording,
    aiGreeting: storedWithoutRecording.aiGreeting?.trim() || base.aiGreeting,
    afterHoursMessage: storedWithoutRecording.afterHoursMessage?.trim() || base.afterHoursMessage,
    missedCallMessage: storedWithoutRecording.missedCallMessage?.trim() || base.missedCallMessage,
    // Cold live transfer media is not production-ready — always message-only.
    liveTransferEnabled: false,
    transferMode: 'message_only',
    maxCallDurationSec: clampCallDurationSec(
      storedWithoutRecording.maxCallDurationSec ?? base.maxCallDurationSec
    ),
    ttsLanguage: normalizeVoiceLang(storedWithoutRecording.ttsLanguage),
    deepgramLanguage: normalizeVoiceLang(storedWithoutRecording.deepgramLanguage),
    sarvamSttLanguage: normalizeVoiceLang(storedWithoutRecording.sarvamSttLanguage),
  };
}

/** Drop leftover consent fields so an old settings blob cannot announce a recording. */
function stripRecordingSettings(
  stored: Partial<CallingSettings> | null | undefined
): Partial<CallingSettings> | null | undefined {
  if (!stored) return stored;
  const next = { ...stored } as Partial<CallingSettings> & {
    recordingConsentEnabled?: unknown;
    recordingConsentMessage?: unknown;
  };
  delete next.recordingConsentEnabled;
  delete next.recordingConsentMessage;
  return next;
}

function normalizeVoiceLang(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'unknown') return null;
  return trimmed;
}

function clampCallDurationSec(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CALLING_SETTINGS.maxCallDurationSec;
  return Math.min(1800, Math.max(120, Math.round(value)));
}

export async function getOrgCallingSettings(organizationId: string): Promise<CallingSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as Record<string, unknown>) || {};
  return mergeCallingSettings(settings.calling as Partial<CallingSettings>);
}

export type SaveCallingSettingsResult = {
  settings: CallingSettings;
  /** Present when the client attempted to enable live transfer (coerced off). */
  warning?: string;
};

export async function saveOrgCallingSettings(
  organizationId: string,
  updates: Partial<CallingSettings>
): Promise<SaveCallingSettingsResult> {
  const requestedLive =
    updates.liveTransferEnabled === true || updates.transferMode === 'live';

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const current = (org?.settings as Record<string, unknown>) || {};
  const existing = mergeCallingSettings(current.calling as Partial<CallingSettings>);
  // mergeCallingSettings forces liveTransferEnabled: false / transferMode: message_only
  const merged = mergeCallingSettings({ ...existing, ...updates });

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: {
        ...current,
        calling: merged as unknown as Prisma.InputJsonValue,
      },
    },
  });

  return {
    settings: merged,
    warning: requestedLive
      ? 'Live voice transfer is not available. The team is notified on WhatsApp instead.'
      : undefined,
  };
}

export function resolveEffectiveVoiceConfig(settings: CallingSettings) {
  const sttLang =
    settings.sarvamSttLanguage &&
    settings.sarvamSttLanguage !== 'unknown' &&
    settings.sarvamSttLanguage !== 'auto'
      ? settings.sarvamSttLanguage
      : settings.ttsLanguage && settings.ttsLanguage !== 'unknown'
        ? settings.ttsLanguage
        : config.sarvam.sttLanguage || 'en-IN';

  return {
    ttsVoice: settings.sarvamTtsSpeaker || settings.ttsVoice || config.sarvam.ttsSpeaker,
    ttsLanguage: sttLang,
    aiGreeting: settings.aiGreeting,
    aiAutoAnswer: settings.aiAutoAnswer,
    sarvamSttLanguage: sttLang,
    sarvamTtsSpeaker: settings.sarvamTtsSpeaker,
    sarvamMode: settings.sarvamMode,
    sarvamSttPrompt: settings.sarvamSttPrompt,
    liveTransferEnabled: settings.liveTransferEnabled,
    transferMode: settings.transferMode,
  };
}

export function resolveCallVoiceConfig(
  settings: CallingSettings,
  bot?: {
    voiceGreeting?: string | null;
    voiceSpeaker?: string | null;
    voiceLanguage?: string | null;
  } | null
) {
  const base = resolveEffectiveVoiceConfig(settings);
  const language = bot?.voiceLanguage?.trim() || base.ttsLanguage;
  const speaker = bot?.voiceSpeaker?.trim() || base.ttsVoice;
  return {
    ...base,
    aiGreeting: bot?.voiceGreeting?.trim() || base.aiGreeting,
    ttsVoice: speaker,
    ttsLanguage: language,
    sarvamSttLanguage: language,
    sarvamTtsSpeaker: speaker,
  };
}
