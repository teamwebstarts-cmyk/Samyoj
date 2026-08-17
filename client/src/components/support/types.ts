export type SupportTab = 'assistant' | 'tickets';

export type SupportChatRole = 'user' | 'assistant';

export interface SupportChatMessage {
  id: string;
  role: SupportChatRole;
  content: string;
}

export type SupportTicketStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';

export interface SupportTicket {
  id: string;
  subject: string;
  body: string;
  status: SupportTicketStatus;
  source: string;
  transcript: string | null;
  createdAt: string;
  updatedAt: string;
}

export const SUPPORT_WELCOME: SupportChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Ask me how to use Samyoj — Connect WhatsApp, Inbox, campaigns, templates, AI bots, and calls. For billing, login, or data issues, open a ticket.',
};
