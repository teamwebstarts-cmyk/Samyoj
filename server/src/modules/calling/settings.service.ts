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

  if (!stored) return base;

  return {
    ...base,
    ...stored,
    aiGreeting: stored.aiGreeting?.trim() || base.aiGreeting,
    afterHoursMessage: stored.afterHoursMessage?.trim() || base.afterHoursMessage,
    missedCallMessage: stored.missedCallMessage?.trim() || base.missedCallMessage,
    recordingConsentMessage:
      stored.recordingConsentMessage?.trim() || base.recordingConsentMessage,
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

export async function saveOrgCallingSettings(
  organizationId: string,
  updates: Partial<CallingSettings>
): Promise<CallingSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const current = (org?.settings as Record<string, unknown>) || {};
  const existing = mergeCallingSettings(current.calling as Partial<CallingSettings>);
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

  return merged;
}

export function resolveEffectiveVoiceConfig(settings: CallingSettings) {
  const useSarvam = Boolean(settings.sarvamTtsSpeaker) || config.calling.voiceProvider === 'sarvam';
  return {
    ttsVoice:
      (useSarvam ? settings.sarvamTtsSpeaker : null) ||
      settings.ttsVoice ||
      config.calling.googleTtsVoice,
    ttsLanguage:
      settings.sarvamSttLanguage ||
      settings.ttsLanguage ||
      config.calling.googleTtsLanguage,
    deepgramLanguage: settings.deepgramLanguage || config.calling.deepgramLanguage,
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
