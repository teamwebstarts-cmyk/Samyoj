export type SupportChatRole = 'user' | 'assistant';

export interface SupportChatMessage {
  id: string;
  role: SupportChatRole;
  content: string;
}

export type SupportStatusReason = 'ready' | 'ai_unconfigured' | 'disabled' | 'daily_cap' | 'checking';

export interface SupportStatusPayload {
  assistantOnline: boolean;
  reason?: Exclude<SupportStatusReason, 'checking'>;
  enabled?: boolean;
  dailyCap?: number | null;
  dailyUsed?: number | null;
}

/** Placeholder so session restore has a stable first row; the empty state does not render it as a bubble. */
export const SUPPORT_WELCOME: SupportChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Ask how to use Samyoj — WhatsApp, Messenger, Instagram, and Email.',
};
