export type CallAction = 'connect' | 'pre_accept' | 'accept' | 'reject' | 'terminate';

export interface CallWebhookSession {
  sdp_type?: string;
  sdp?: string;
}

export interface CallWebhookEntry {
  id: string;
  to?: string;
  from?: string;
  event?: string;
  timestamp?: string;
  direction?: 'USER_INITIATED' | 'BUSINESS_INITIATED';
  status?: string[];
  start_time?: string;
  end_time?: string;
  duration?: number;
  session?: CallWebhookSession;
  biz_opaque_callback_data?: string;
}

export interface TranscriptEntry {
  role: 'user' | 'assistant' | 'system';
  text: string;
  at: string;
}

export interface ActiveCallContext {
  callId: string;
  metaCallId: string;
  organizationId: string;
  conversationId: string;
  contactId: string;
  phoneNumberId: string;
  accessToken: string;
  fromPhone: string;
  toPhone: string;
  direction: 'USER_INITIATED' | 'BUSINESS_INITIATED';
  aiBotId?: string | null;
  greeting?: string;
  consentMessage?: string;
  ttsVoice?: string;
  ttsLanguage?: string;
  /** Sarvam STT terminology hint (not the bot brain prompt). */
  sttPrompt?: string;
  sttMode?: string;
}
