export type AfterHoursMode = 'ai' | 'message' | 'missed';
export type CallRoutingMode = 'ai_only' | 'agents_first' | 'ai_then_agents';
export type TransferMode = 'live' | 'message_only';

export interface CallingSettings {
  aiAutoAnswer: boolean;
  aiGreeting: string;
  defaultBotId: string | null;
  routingMode: CallRoutingMode;
  agentRingTimeoutSec: number;
  maxConcurrentCalls: number;
  afterHoursMode: AfterHoursMode;
  afterHoursMessage: string;
  missedCallAutoMessage: boolean;
  missedCallMessage: string;
  recordingConsentEnabled: boolean;
  recordingConsentMessage: string;
  ttsVoice: string | null;
  ttsLanguage: string | null;
  deepgramLanguage: string | null;
  sarvamSttLanguage: string | null;
  sarvamTtsSpeaker: string | null;
  sarvamMode: 'codemix' | 'transcribe';
  /** Optional terminology hints for Saaras final transcript (brand names, etc.). */
  sarvamSttPrompt: string | null;
  liveTransferEnabled: boolean;
  transferMode: TransferMode;
}

export const DEFAULT_CALLING_SETTINGS: CallingSettings = {
  aiAutoAnswer: true,
  aiGreeting: 'Hello! Thank you for calling. How can I help you today?',
  defaultBotId: null,
  routingMode: 'ai_then_agents',
  agentRingTimeoutSec: 25,
  maxConcurrentCalls: 10,
  afterHoursMode: 'ai',
  afterHoursMessage:
    'Thanks for calling. We are currently closed. Please leave a message in chat and we will get back to you.',
  missedCallAutoMessage: true,
  missedCallMessage:
    'Sorry we missed your call! Reply here on WhatsApp and our team will help you shortly.',
  recordingConsentEnabled: false,
  recordingConsentMessage:
    'This call may be recorded for quality and training purposes.',
  ttsVoice: null,
  ttsLanguage: null,
  deepgramLanguage: null,
  sarvamSttLanguage: null,
  sarvamTtsSpeaker: null,
  sarvamMode: 'codemix',
  sarvamSttPrompt: null,
  liveTransferEnabled: false,
  transferMode: 'message_only',
};
