export type SupportChatRole = 'user' | 'assistant';

export interface SupportChatMessage {
  id: string;
  role: SupportChatRole;
  content: string;
}

/** Placeholder so session restore has a stable first row; the empty state does not render it as a bubble. */
export const SUPPORT_WELCOME: SupportChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Ask how to use Samyoj — WhatsApp, Inbox, campaigns, templates, and AI bots.',
};
