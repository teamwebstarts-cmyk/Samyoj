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

  if (!stored) {
    return {
      ...base,
      // Cold live transfer media is not production-ready — always message-only.
      liveTransferEnabled: false,
      transferMode: 'message_only',
    };
  }

  return {
    ...base,
    ...stored,
    aiGreeting: stored.aiGreeting?.trim() || base.aiGreeting,
    afterHoursMessage: stored.afterHoursMessage?.trim() || base.afterHoursMessage,
    missedCallMessage: stored.missedCallMessage?.trim() || base.missedCallMessage,
    recordingConsentMessage:
      stored.recordingConsentMessage?.trim() || base.recordingConsentMessage,
    // Cold live transfer media is not production-ready — always message-only.
    liveTransferEnabled: false,
    transferMode: 'message_only',
  };
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
      ? 'Live voice transfer coming soon — human handoff stays in Inbox for now.'
      : undefined,
  };
}

export function resolveEffectiveVoiceConfig(settings: CallingSettings) {
  return {
    ttsVoice: settings.sarvamTtsSpeaker || settings.ttsVoice || config.sarvam.ttsSpeaker,
    ttsLanguage: settings.sarvamSttLanguage || settings.ttsLanguage || config.sarvam.sttLanguage,
    aiGreeting: settings.aiGreeting,
    aiAutoAnswer: settings.aiAutoAnswer,
    sarvamSttLanguage: settings.sarvamSttLanguage,
    sarvamTtsSpeaker: settings.sarvamTtsSpeaker,
    sarvamMode: settings.sarvamMode,
    sarvamSttPrompt: settings.sarvamSttPrompt,
    liveTransferEnabled: settings.liveTransferEnabled,
    transferMode: settings.transferMode,
  };
}
