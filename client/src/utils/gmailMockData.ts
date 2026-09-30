import type { GmailContact, GmailSend, GmailStatus, GmailTemplate } from '../services/api';

export const GMAIL_MOCK_MAILBOX = 'support@samyoj.com';

const now = Date.now();
const hoursAgo = (hours: number) => new Date(now - hours * 60 * 60 * 1000).toISOString();

export function getGmailMockStatus(): GmailStatus {
  return {
    connected: true,
    email: GMAIL_MOCK_MAILBOX,
    status: 'connected',
    reconnectReason: null,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
  };
}

export function getGmailMockContacts(): GmailContact[] {
  const consentAt = hoursAgo(72);
  const base = {
    emailConsentSource: 'EMAIL_COMPOSE',
    emailConsentVersion: 'email-consent-v1',
    emailConsentAt: consentAt,
    emailOptOutAt: null,
  };
  return [
    { id: 'gmail-mock-contact-01', name: 'Rohit Sharma', email: 'rohit.sharma@gmail.com', emailOptedIn: true, eligible: true, ...base },
    { id: 'gmail-mock-contact-02', name: 'Priya Patel', email: 'priya.patel@acme.in', emailOptedIn: true, eligible: true, ...base },
    { id: 'gmail-mock-contact-03', name: 'Amit Kumar', email: 'amit.kumar@gmail.com', emailOptedIn: true, eligible: true, ...base },
    { id: 'gmail-mock-contact-04', name: 'Neha Singh', email: 'neha.singh@startup.io', emailOptedIn: true, eligible: true, ...base },
    { id: 'gmail-mock-contact-05', name: 'Vikram Mehta', email: 'vikram.mehta@example.com', emailOptedIn: false, eligible: false, ...base, emailConsentAt: null },
    { id: 'gmail-mock-contact-06', name: 'Ananya Iyer', email: 'ananya.iyer@design.co', emailOptedIn: true, eligible: true, ...base },
    { id: 'gmail-mock-contact-07', name: 'Karan Joshi', email: 'karan.joshi@shop.com', emailOptedIn: true, eligible: true, ...base },
    { id: 'gmail-mock-contact-08', name: 'Sneha Reddy', email: 'sneha.reddy@health.in', emailOptedIn: true, eligible: true, ...base },
  ];
}

export function getGmailMockTemplates(): GmailTemplate[] {
  const stamp = hoursAgo(120);
  return [
    { id: 'gmail-mock-tpl-01', name: 'Welcome', subject: 'Welcome to {{company}}', textBody: 'Hi {{name}},\n\nWelcome aboard — glad to have you with us.\n\nThanks,\nSamyoj Team', htmlBody: null, createdAt: stamp, updatedAt: stamp },
    { id: 'gmail-mock-tpl-02', name: 'Order confirmation', subject: 'Your order {{order_id}} is confirmed', textBody: 'Hi {{name}},\n\nYour order {{order_id}} is confirmed. We will keep you posted.\n\nThanks,\nSamyoj Team', htmlBody: null, createdAt: stamp, updatedAt: stamp },
    { id: 'gmail-mock-tpl-03', name: 'Order shipped', subject: 'Your order {{order_id}} has shipped', textBody: 'Hi {{name}},\n\nYour order is on the way. Tracking details are in your account.\n\nThanks,\nSamyoj Team', htmlBody: null, createdAt: stamp, updatedAt: stamp },
    { id: 'gmail-mock-tpl-04', name: 'Payment reminder', subject: 'Payment reminder for your account', textBody: 'Hi {{name}},\n\nFriendly reminder that your payment is due. Reply if you need help.\n\nThanks,\nSamyoj Team', htmlBody: null, createdAt: stamp, updatedAt: stamp },
    { id: 'gmail-mock-tpl-05', name: 'Demo follow-up', subject: 'Thanks for joining our demo', textBody: 'Hi {{name}},\n\nThanks for joining the demo. Reply when you are ready for the next step.\n\nBest,\nSamyoj Team', htmlBody: null, createdAt: stamp, updatedAt: stamp },
    { id: 'gmail-mock-tpl-06', name: 'Invoice ready', subject: 'Your invoice is ready', textBody: 'Hi {{name}},\n\nYour invoice is ready to review. Reply with any questions.\n\nThanks,\nSamyoj Team', htmlBody: null, createdAt: stamp, updatedAt: stamp },
    { id: 'gmail-mock-tpl-07', name: 'Appointment reminder', subject: 'Reminder: your appointment on {{date}}', textBody: 'Hi {{name}},\n\nReminder for your appointment on {{date}} at {{time}}.\n\nSee you then,\nSamyoj Team', htmlBody: null, createdAt: stamp, updatedAt: stamp },
    { id: 'gmail-mock-tpl-08', name: 'Feedback request', subject: 'How did we do?', textBody: 'Hi {{name}},\n\nWe would value your feedback about your recent experience.\n\nBest,\nSamyoj Team', htmlBody: null, createdAt: stamp, updatedAt: stamp },
  ];
}

const SEND_SEEDS: Array<{
  recipientName: string;
  recipientEmail: string;
  subject: string;
  textBody: string;
  fail?: boolean;
  failReason?: string;
}> = [
  {
    recipientName: 'Rohit Sharma',
    recipientEmail: 'rohit.sharma@gmail.com',
    subject: 'Your order #4821 is confirmed',
    textBody: 'Hi Rohit,\n\nYour order #4821 is confirmed. We will email tracking once it ships.\n\nThanks,\nSamyoj Team',
  },
  {
    recipientName: 'Priya Patel',
    recipientEmail: 'priya.patel@acme.in',
    subject: 'Thanks for joining our demo',
    textBody: 'Hi Priya,\n\nThanks for joining the demo yesterday. Reply when you want pricing for your team.\n\nBest,\nSamyoj Team',
  },
  {
    recipientName: 'Amit Kumar',
    recipientEmail: 'amit.kumar@gmail.com',
    subject: 'Payment reminder for your account',
    textBody: 'Hi Amit,\n\nThis is a friendly reminder that your payment is due.\n\nThanks,\nSamyoj Team',
    fail: true,
    failReason: 'Gmail rejected this message (sample row).',
  },
  {
    recipientName: 'Neha Singh',
    recipientEmail: 'neha.singh@startup.io',
    subject: 'Your invoice is ready',
    textBody: 'Hi Neha,\n\nYour invoice is ready to review in the portal.\n\nThanks,\nSamyoj Team',
  },
  {
    recipientName: 'Ananya Iyer',
    recipientEmail: 'ananya.iyer@design.co',
    subject: 'Delivery update for order #9102',
    textBody: 'Hi Ananya,\n\nYour package is out for delivery today.\n\nThanks,\nSamyoj Team',
  },
];

/** Dashboard mockup totals: 124 sent, 118 accepted, 6 failed, 8 templates. */
export function getGmailMockSends(): GmailSend[] {
  const sends: GmailSend[] = [];
  let failed = 0;
  for (let i = 0; i < 124; i += 1) {
    const seed = SEND_SEEDS[i % SEND_SEEDS.length];
    const shouldFail = failed < 6 && (seed.fail || i % 21 === 13);
    const status = shouldFail ? 'failed' : 'accepted';
    if (shouldFail) failed += 1;
    const createdAt = hoursAgo(2 + i * 3.5);
    sends.push({
      id: `gmail-mock-send-${String(i + 1).padStart(3, '0')}`,
      recipientEmail: seed.recipientEmail,
      recipientName: seed.recipientName,
      subject: seed.subject,
      textBody: seed.textBody,
      status,
      statusReason: shouldFail ? seed.failReason || 'Gmail did not accept this email.' : null,
      createdAt,
      acceptedAt: shouldFail ? null : createdAt,
      failedAt: shouldFail ? createdAt : null,
    });
  }
  return sends.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const GMAIL_MOCK_PREVIEW_BLOCK =
  'Sample mailbox is on. Turn off preview data in Settings → Channels to connect Gmail or send for real.';
