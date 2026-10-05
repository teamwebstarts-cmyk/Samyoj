import type { AppNotification } from '../components/layout/notificationTypes';

export const NOTIFICATION_MOCK_ID_PREFIX = 'mock-notif-';

export function isNotificationMockId(id: string): boolean {
  return id.startsWith(NOTIFICATION_MOCK_ID_PREFIX);
}

const now = Date.now();

/** Sample alerts for the notification drawer when Channel preview mock data is on. */
export function getNotificationMockAlerts(reference = now): AppNotification[] {
  const t = (minutesAgo: number) => reference - minutesAgo * 60_000;
  return [
    {
      id: `${NOTIFICATION_MOCK_ID_PREFIX}msg-01`,
      category: 'messages',
      title: 'New message from Priya Sharma',
      body: 'Hi, can you share the invoice for order #4821?',
      href: '/inbox?conversation=mock-preview-wa',
      at: t(2),
      tone: 'whatsapp',
    },
    {
      id: `${NOTIFICATION_MOCK_ID_PREFIX}msg-02`,
      category: 'messages',
      title: 'New message from Rahul Mehta',
      body: 'Thanks — we received the catalog on WhatsApp.',
      href: '/inbox?conversation=mock-preview-wa-2',
      at: t(18),
      tone: 'whatsapp',
    },
    {
      id: `${NOTIFICATION_MOCK_ID_PREFIX}msg-fb`,
      category: 'messages',
      title: 'Messenger from Ananya Store',
      body: 'Is the Saturday slot still available?',
      href: '/facebook/inbox?thread=mock-preview-fb',
      at: t(35),
      tone: 'whatsapp',
    },
    {
      id: `${NOTIFICATION_MOCK_ID_PREFIX}ticket-01`,
      category: 'tickets',
      title: 'Refund request — UPI payment',
      body: 'Reply overdue',
      href: '/tickets?ticket=mock-preview-ticket-1',
      at: t(90),
      tone: 'danger',
    },
    {
      id: `${NOTIFICATION_MOCK_ID_PREFIX}ticket-02`,
      category: 'tickets',
      title: 'Template approval follow-up',
      body: 'Reply overdue',
      href: '/tickets?ticket=mock-preview-ticket-2',
      at: t(240),
      tone: 'danger',
    },
    {
      id: `${NOTIFICATION_MOCK_ID_PREFIX}update-ai`,
      category: 'updates',
      title: 'AI could not reply in Inbox',
      body: 'Inbox: outside service window — send a template or wait for customer reply.',
      href: '/inbox?conversation=mock-preview-wa',
      at: t(12),
      tone: 'warning',
    },
    {
      id: `${NOTIFICATION_MOCK_ID_PREFIX}update-budget`,
      category: 'updates',
      title: 'Generation budget warning',
      body: 'You are nearing today’s content limit. Open Billing & usage for details.',
      href: '/billing?tab=usage',
      at: t(420),
      tone: 'sky',
    },
    {
      id: `${NOTIFICATION_MOCK_ID_PREFIX}update-ig`,
      category: 'updates',
      title: 'New Instagram comment on your post',
      body: '“Do you ship to Pune?” — review in Comments.',
      href: '/instagram/comments',
      at: t(55),
      tone: 'neutral',
    },
    {
      id: `${NOTIFICATION_MOCK_ID_PREFIX}agent-01`,
      category: 'agents',
      title: 'Neha (Agent) left a note',
      body: 'Customer wants COD only — confirm before sending payment link.',
      href: '/inbox?conversation=mock-preview-wa',
      at: t(8),
      tone: 'neutral',
    },
    {
      id: `${NOTIFICATION_MOCK_ID_PREFIX}agent-02`,
      category: 'agents',
      title: 'Arjun (Agent) left a note',
      body: 'Escalated to supervisor — please pick up Messenger thread.',
      href: '/facebook/inbox?thread=mock-preview-fb',
      at: t(44),
      tone: 'neutral',
    },
  ];
}
