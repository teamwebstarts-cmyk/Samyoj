import { useEffect, useState } from 'react';
import { useMetaMock } from '../../contexts/MetaMockContext';

/** Mock data for the Email UI pass (backend wiring comes after pixel approval). */

export interface EmailStats {
  totalSent: number;
  totalTrend: string;
  accepted: number;
  acceptedTrend: string;
  failed: number;
  failedTrend: string;
  templates: number;
  templatesTrend: string;
}

export const MOCK_STATS: EmailStats = {
  totalSent: 124,
  totalTrend: '+20%',
  accepted: 118,
  acceptedTrend: '+18%',
  failed: 6,
  failedTrend: '+28%',
  templates: 8,
  templatesTrend: '+4%',
};

export type EmailSendStatus = 'ACCEPTED' | 'FAILED';

export interface EmailRecentSend {
  id: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  sentAt: string;
  status: EmailSendStatus;
  /** Shown on the detail pane when status is FAILED. */
  failReason?: string;
  avatar: 'blue' | 'violet' | 'pink' | 'green' | 'amber';
}

const SAMPLE_RECENT_SENDS: EmailRecentSend[] = [
  {
    id: 's1',
    name: 'Rohit Sharma',
    email: 'rohit.sharma@gmail.com',
    subject: 'Order #12345 confirmation',
    body: 'Hi Rohit,\n\nYour order #12345 is confirmed. We will share tracking details as soon as it ships.\n\nThanks,\nSamyoj Team',
    sentAt: 'Sep 28, 2026 11:24 AM',
    status: 'ACCEPTED',
    avatar: 'blue',
  },
  {
    id: 's2',
    name: 'Sneha Verma',
    email: 'sneha.verma@gmail.com',
    subject: 'Product demo details',
    body: 'Hi Sneha,\n\nHere are the details for tomorrow’s product demo. Reply to this mailbox if you need a different time.\n\nThanks,\nSamyoj Team',
    sentAt: 'Sep 28, 2026 10:13 AM',
    status: 'ACCEPTED',
    avatar: 'violet',
  },
  {
    id: 's3',
    name: 'Amit Kumar',
    email: 'amit.kumar@gmail.com',
    subject: 'Updated pricing information',
    body: 'Hi Amit,\n\nSharing the updated pricing for your account. Let us know if you want a walkthrough.\n\nThanks,\nSamyoj Team',
    sentAt: 'Sep 27, 2026 04:32 PM',
    status: 'FAILED',
    failReason: 'Google paused sending for this mailbox. Wait up to 24 hours.',
    avatar: 'green',
  },
  {
    id: 's4',
    name: 'Priya Mehta',
    email: 'priya.mehta@gmail.com',
    subject: 'Welcome to Samyoj',
    body: 'Hi Priya,\n\nWelcome to Samyoj. Your workspace is ready — open the dashboard whenever you want to send the next note.\n\nThanks,\nSamyoj Team',
    sentAt: 'Sep 26, 2026 02:11 PM',
    status: 'ACCEPTED',
    avatar: 'pink',
  },
  {
    id: 's5',
    name: 'Vikram Singh',
    email: 'vikram.singh@gmail.com',
    subject: 'Your invoice is ready',
    body: 'Hi Vikram,\n\nYour invoice is ready. This note was accepted by Gmail — delivery and open status are not shown here.\n\nThanks,\nSamyoj Team',
    sentAt: 'Sep 26, 2026 11:03 AM',
    status: 'ACCEPTED',
    avatar: 'amber',
  },
];

/** ponytail: sessionStorage until an EmailSend table exists. Refresh in a new tab restores the sample list. */
const RECENT_SENDS_KEY = 'samyoj.email.recentSends';

function loadRecentSends(): EmailRecentSend[] {
  try {
    const raw = sessionStorage.getItem(RECENT_SENDS_KEY);
    if (!raw) return SAMPLE_RECENT_SENDS.map((send) => ({ ...send }));
    const parsed = JSON.parse(raw) as EmailRecentSend[];
    if (!Array.isArray(parsed)) return SAMPLE_RECENT_SENDS.map((send) => ({ ...send }));
    return parsed;
  } catch {
    return SAMPLE_RECENT_SENDS.map((send) => ({ ...send }));
  }
}

let recentSends = loadRecentSends();
const recentSendListeners = new Set<() => void>();

function publishRecentSends() {
  sessionStorage.setItem(RECENT_SENDS_KEY, JSON.stringify(recentSends));
  recentSendListeners.forEach((listener) => listener());
}

export function useRecentSends() {
  const [sends, setSends] = useState(recentSends);
  useEffect(() => {
    const sync = () => setSends(recentSends);
    recentSendListeners.add(sync);
    sync();
    return () => {
      recentSendListeners.delete(sync);
    };
  }, []);
  return sends;
}

export function deleteRecentSend(id: string) {
  recentSends = recentSends.filter((send) => send.id !== id);
  publishRecentSends();
}

export interface EmailContact {
  id: string;
  name: string;
  email: string;
  /** Eligible = has valid email AND email permission on. */
  eligible: boolean;
  avatar: 'blue' | 'violet' | 'pink' | 'green' | 'amber';
}

export const MOCK_CONTACTS: EmailContact[] = [
  { id: 'c1', name: 'Rohit Sharma', email: 'rohit.sharma@gmail.com', eligible: true, avatar: 'blue' },
  { id: 'c2', name: 'Sneha Verma', email: 'sneha.verma@gmail.com', eligible: true, avatar: 'violet' },
  { id: 'c3', name: 'Amit Kumar', email: 'amit.kumar@gmail.com', eligible: true, avatar: 'green' },
  { id: 'c4', name: 'Priya Mehta', email: 'priya.mehta@gmail.com', eligible: true, avatar: 'pink' },
  { id: 'c5', name: 'Vikram Singh', email: 'vikram.singh@gmail.com', eligible: true, avatar: 'amber' },
  { id: 'c6', name: 'Neha Gupta', email: 'neha.gupta@gmail.com', eligible: true, avatar: 'blue' },
  { id: 'c7', name: 'Aditya Jain', email: 'aditya.jain@gmail.com', eligible: true, avatar: 'violet' },
  { id: 'c8', name: 'Kavya Patel', email: 'kavya.patel@gmail.com', eligible: true, avatar: 'green' },
  { id: 'c9', name: 'Rahul Yadav', email: 'rahul.yadav@gmail.com', eligible: false, avatar: 'pink' },
  { id: 'c10', name: 'Pooja Nair', email: 'pooja.nair@gmail.com', eligible: false, avatar: 'amber' },
];

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  textBody: string;
  updatedAt: string;
}

export const MOCK_TEMPLATES: EmailTemplate[] = [
  {
    id: 't1',
    name: 'Order follow-up',
    subject: 'Your order {{order_id}} is on the way',
    textBody:
      "Hi {{name}},\n\nWe're excited to let you know that your order has been shipped.\n\nThanks,\nSamyoj Team",
    updatedAt: 'Sep 28, 2026',
  },
  {
    id: 't2',
    name: 'Welcome note',
    subject: 'Welcome to {{company}}',
    textBody:
      'Hi {{name}},\n\nWelcome aboard! We are glad to have you with us.\n\nThanks,\nSamyoj Team',
    updatedAt: 'Sep 25, 2026',
  },
  {
    id: 't3',
    name: 'Payment reminder',
    subject: 'Payment reminder for your account',
    textBody:
      'Hi {{name}},\n\nThis is a gentle reminder that your payment is due.\n\nThanks,\nSamyoj Team',
    updatedAt: 'Sep 24, 2026',
  },
];

export const MOCK_MAILBOX = {
  email: 'support@samyoj.com',
  /** Sample address only. Live "connected" follows Settings → Meta preview data. */
  connected: false,
};

export const TEMPLATE_VARIABLES = ['{{name}}', '{{email}}', '{{phone}}'] as const;

/** ponytail: sessionStorage until email templates have a table. A new tab restores the samples. */
const TEMPLATES_KEY = 'samyoj.email.templates';

function loadTemplates(): EmailTemplate[] {
  try {
    const raw = sessionStorage.getItem(TEMPLATES_KEY);
    if (!raw) return MOCK_TEMPLATES.map((template) => ({ ...template }));
    const parsed = JSON.parse(raw) as EmailTemplate[];
    if (!Array.isArray(parsed)) return MOCK_TEMPLATES.map((template) => ({ ...template }));
    return parsed;
  } catch {
    return MOCK_TEMPLATES.map((template) => ({ ...template }));
  }
}

let emailTemplates = loadTemplates();
const templateListeners = new Set<() => void>();

function publishTemplates() {
  sessionStorage.setItem(TEMPLATES_KEY, JSON.stringify(emailTemplates));
  templateListeners.forEach((listener) => listener());
}

export function useEmailTemplates() {
  const [templates, setTemplates] = useState(emailTemplates);
  useEffect(() => {
    const sync = () => setTemplates(emailTemplates);
    templateListeners.add(sync);
    sync();
    return () => {
      templateListeners.delete(sync);
    };
  }, []);
  return templates;
}

export function upsertEmailTemplate(template: EmailTemplate) {
  const index = emailTemplates.findIndex((item) => item.id === template.id);
  emailTemplates = index === -1
    ? [template, ...emailTemplates]
    : emailTemplates.map((item) => (item.id === template.id ? template : item));
  publishTemplates();
}

export function removeEmailTemplate(id: string) {
  emailTemplates = emailTemplates.filter((template) => template.id !== id);
  publishTemplates();
}

/** Gmail is not wired yet. Preview data appears only when Settings → Meta preview data is on. */
export function useEmailPreview() {
  const { enabled } = useMetaMock();
  const storedSends = useRecentSends();
  const storedTemplates = useEmailTemplates();
  return {
    preview: enabled,
    connected: enabled,
    mailboxEmail: enabled ? MOCK_MAILBOX.email : '',
    sends: enabled ? storedSends : [],
    templates: enabled ? storedTemplates : [],
    contacts: enabled ? MOCK_CONTACTS : [],
  };
}
