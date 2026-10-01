import { useCallback, useEffect, useState } from 'react';
import { useMetaMock } from '../../contexts/MetaMockContext';
import { gmailApi, type GmailContact, type GmailSend, type GmailStatus, type GmailTemplate } from '../../services/api';
import {
  getGmailMockContacts,
  getGmailMockSends,
  getGmailMockStatus,
  getGmailMockTemplates,
} from '../../utils/gmailMockData';
import { getErrorMessage } from '../../utils/errors';

export const GMAIL_MAX_ATTACHMENTS = 5;
export const GMAIL_MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const GMAIL_MAX_DECODED_MIME_BYTES = 20 * 1024 * 1024;
export const GMAIL_EMAIL_CONSENT_SOURCE = 'EMAIL_COMPOSE';
export const GMAIL_EMAIL_CONSENT_VERSION = 'email-consent-v1';

export const GMAIL_ALLOWED_ATTACHMENT_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export const EMAIL_TEMPLATE_LIBRARY = [
  {
    id: 'library-welcome',
    name: 'Welcome',
    subject: 'Welcome to {{company}}',
    textBody: 'Hi {{name}},\n\nWelcome aboard. We are glad to have you with us.\n\nThanks,\n{{company}} Team',
  },
  {
    id: 'library-order-confirmation',
    name: 'Order confirmation',
    subject: 'Your order {{order_id}} is confirmed',
    textBody: 'Hi {{name}},\n\nYour order {{order_id}} is confirmed. We will keep you posted.\n\nThanks,\n{{company}} Team',
  },
  {
    id: 'library-order-shipped',
    name: 'Order shipped',
    subject: 'Your order {{order_id}} has shipped',
    textBody: 'Hi {{name}},\n\nYour order {{order_id}} is on the way. Tracking details are below.\n\nThanks,\n{{company}} Team',
  },
  {
    id: 'library-delivery-update',
    name: 'Delivery update',
    subject: 'Delivery update for order {{order_id}}',
    textBody: 'Hi {{name}},\n\nHere is the latest update on your delivery. Reply if you need help.\n\nThanks,\n{{company}} Team',
  },
  {
    id: 'library-payment-received',
    name: 'Payment received',
    subject: 'Payment received',
    textBody: 'Hi {{name}},\n\nWe received your payment. Thank you for taking care of this.\n\nThanks,\n{{company}} Team',
  },
  {
    id: 'library-payment-reminder',
    name: 'Payment reminder',
    subject: 'Payment reminder for your account',
    textBody: 'Hi {{name}},\n\nThis is a friendly reminder that your payment is due. Please reply if you need help.\n\nThanks,\n{{company}} Team',
  },
  {
    id: 'library-appointment-reminder',
    name: 'Appointment reminder',
    subject: 'Reminder: your appointment on {{date}}',
    textBody: 'Hi {{name}},\n\nThis is a reminder for your appointment on {{date}} at {{time}}.\n\nSee you then,\n{{company}} Team',
  },
  {
    id: 'library-demo-follow-up',
    name: 'Demo follow-up',
    subject: 'Thanks for joining our demo',
    textBody: 'Hi {{name}},\n\nThanks for joining the demo. Reply when you are ready for the next step.\n\nBest,\n{{company}} Team',
  },
  {
    id: 'library-invoice-ready',
    name: 'Invoice ready',
    subject: 'Your invoice is ready',
    textBody: 'Hi {{name}},\n\nYour invoice is ready to review. Please reply if you have any questions.\n\nThanks,\n{{company}} Team',
  },
  {
    id: 'library-feedback-request',
    name: 'Feedback request',
    subject: 'How did we do?',
    textBody: 'Hi {{name}},\n\nWe would value your feedback about your recent experience. Thank you for helping us improve.\n\nBest,\n{{company}} Team',
  },
  {
    id: 'library-meeting-confirmation',
    name: 'Meeting confirmation',
    subject: 'Meeting confirmed for {{date}}',
    textBody: 'Hi {{name}},\n\nYour meeting is confirmed for {{date}} at {{time}}. We look forward to speaking with you.\n\nBest,\n{{company}} Team',
  },
  {
    id: 'library-service-update',
    name: 'Service update',
    subject: 'An update about your service',
    textBody: 'Hi {{name}},\n\nWe have an update about your service. Reply to this email if you need assistance.\n\nThanks,\n{{company}} Team',
  },
] as const;

export type EmailAvatar = 'blue' | 'violet' | 'pink' | 'green' | 'amber';

export function avatarFor(value: string): EmailAvatar {
  const avatars: EmailAvatar[] = ['blue', 'violet', 'pink', 'green', 'amber'];
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return avatars[Math.abs(hash) % avatars.length];
}

export function initials(name: string | null, email = '') {
  const source = name?.trim() || email;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function gmailCallbackErrorFromSearch(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (params.get('status') !== 'failed') return '';
  const reason = params.get('reason')?.trim();
  return reason || 'Gmail could not connect. Click Connect Gmail again.';
}

export function statusLabel(status: GmailSend['status']) {
  switch (status) {
    case 'accepted':
      return 'Accepted by Gmail';
    case 'reconnect-required':
      return 'Reconnect required';
    case 'ambiguous':
      return 'Status unknown';
    case 'sending':
      return 'Sending';
    case 'failed':
      return 'Failed';
    default:
      return 'Queued';
  }
}

export function safeHtmlFromMarkup(input: string): string | null {
  if (!input.trim()) return null;
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const tokens = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
  let cursor = 0;
  let html = '';
  for (const match of input.matchAll(tokens)) {
    const index = match.index ?? 0;
    html += escape(input.slice(cursor, index)).replace(/\n/g, '<br />');
    const token = match[0];
    if (token.startsWith('**')) {
      html += `<strong>${escape(token.slice(2, -2))}</strong>`;
    } else if (token.startsWith('*')) {
      html += `<em>${escape(token.slice(1, -1))}</em>`;
    } else {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (link) {
        html += `<a href="${escape(link[2])}" target="_blank" rel="noopener noreferrer">${escape(link[1])}</a>`;
      } else {
        html += escape(token);
      }
    }
    cursor = index + token.length;
  }
  html += escape(input.slice(cursor)).replace(/\n/g, '<br />');
  return html;
}

export function plainTextFromMarkup(input: string) {
  return input
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/\[([^\]\n]+)\]\(https?:\/\/[^\s)]+\)/g, '$1');
}

export function errorCode(error: unknown) {
  const response = (error as { response?: { data?: { error?: { code?: string } } } })?.response;
  return response?.data?.error?.code;
}

export function nextTemplateName(name: string, templates: GmailTemplate[]) {
  const names = new Set(templates.map((template) => template.name.trim().toLowerCase()));
  const base = name.trim() || 'Copied template';
  if (!names.has(base.toLowerCase())) return base;
  let index = 1;
  while (names.has(`${base} (Copy${index > 1 ? ` ${index}` : ''})`.toLowerCase())) index += 1;
  return `${base} (Copy${index > 1 ? ` ${index}` : ''})`;
}

export interface GmailWorkspace {
  status: GmailStatus | null;
  contacts: GmailContact[];
  templates: GmailTemplate[];
  sends: GmailSend[];
  loading: boolean;
  error: string;
  /** Sample mailbox from Settings → Channels preview (not a real Gmail connection). */
  mockPreview: boolean;
  refresh: () => void;
}

/** Channel switcher / top bar: mock preview or a live connected mailbox. */
export function useGmailChannelAvailable(): boolean {
  const { enabled: mockEnabled } = useMetaMock();
  const [liveConnected, setLiveConnected] = useState(false);

  useEffect(() => {
    let active = true;
    void gmailApi
      .status()
      .then((response) => {
        if (active) setLiveConnected(response.data.data.status === 'connected');
      })
      .catch(() => {
        if (active) setLiveConnected(false);
      });
    return () => {
      active = false;
    };
  }, [mockEnabled]);

  return mockEnabled || liveConnected;
}

function applyGmailMockWorkspace(): Pick<GmailWorkspace, 'status' | 'contacts' | 'templates' | 'sends' | 'mockPreview'> {
  return {
    status: getGmailMockStatus(),
    contacts: getGmailMockContacts(),
    templates: getGmailMockTemplates(),
    sends: getGmailMockSends(),
    mockPreview: true,
  };
}

export function useGmailWorkspace(): GmailWorkspace {
  const { enabled: mockEnabled } = useMetaMock();
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [contacts, setContacts] = useState<GmailContact[]>([]);
  const [templates, setTemplates] = useState<GmailTemplate[]>([]);
  const [sends, setSends] = useState<GmailSend[]>([]);
  const [mockPreview, setMockPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (reloadKey === 0) setLoading(true);
    setError('');
    void gmailApi.status()
      .then(async (statusResponse) => {
        const liveStatus = statusResponse.data.data;
        if (!active) return;
        if (mockEnabled && liveStatus.status === 'disconnected') {
          const mock = applyGmailMockWorkspace();
          setStatus(mock.status);
          setContacts(mock.contacts);
          setTemplates(mock.templates);
          setSends(mock.sends);
          setMockPreview(true);
          return;
        }
        setMockPreview(false);
        setStatus(liveStatus);
        if (liveStatus.status === 'disconnected') {
          setContacts([]);
          setTemplates([]);
          setSends([]);
          return;
        }
        const [contactResponse, templateResponse, sendResponse] = await Promise.all([
          gmailApi.contacts(),
          gmailApi.templates(),
          gmailApi.sends(),
        ]);
        if (!active) return;
        setContacts(contactResponse.data.data);
        setTemplates(templateResponse.data.data);
        setSends(sendResponse.data.data);
      })
      .catch((cause: unknown) => {
        if (active) setError(getErrorMessage(cause, 'Could not load Gmail data.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey, mockEnabled]);

  useEffect(() => {
    if (mockPreview) return;
    const pending = sends.some((send) => send.status === 'queued' || send.status === 'sending');
    if (!pending) return;
    const timer = window.setInterval(() => setReloadKey((value) => value + 1), 8_000);
    return () => window.clearInterval(timer);
  }, [sends, mockPreview]);

  const refresh = useCallback(() => setReloadKey((value) => value + 1), []);
  return { status, contacts, templates, sends, loading, error, mockPreview, refresh };
}
