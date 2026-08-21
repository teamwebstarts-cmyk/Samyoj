import prisma from '../config/database';
import { sendEmail } from './email.service';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('notifications');

export type NotificationEvent =
  | 'assignment'
  | 'campaign_complete';

interface NotificationPayload {
  organizationId: string;
  event: NotificationEvent;
  userId?: string;
  email?: string;
  subject: string;
  text: string;
}

export async function notifyUser(payload: NotificationPayload): Promise<void> {
  let email = payload.email;

  if (!email && payload.userId) {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { email: true },
    });
    email = user?.email;
  }

  if (!email) {
    log.info('Notification skipped — no email', { event: payload.event });
    return;
  }

  await sendEmail({
    to: email,
    subject: payload.subject,
    text: payload.text,
  });
}

export async function notifyAssignment(
  organizationId: string,
  agentId: string,
  _conversationId: string,
  contactName: string
) {
  await notifyUser({
    organizationId,
    event: 'assignment',
    userId: agentId,
    subject: 'New conversation assigned to you',
    text: `You have been assigned a conversation with ${contactName}.\n\nOpen inbox: ${process.env.CLIENT_URL || 'http://localhost:5173'}/inbox`,
  });
}

export async function notifyCampaignComplete(
  organizationId: string,
  ownerEmail: string,
  campaignName: string,
  stats: { sent: number; failed: number; delivered: number }
) {
  await notifyUser({
    organizationId,
    event: 'campaign_complete',
    email: ownerEmail,
    subject: `Campaign complete: ${campaignName}`,
    text: `Your campaign "${campaignName}" has finished.\n\nSent: ${stats.sent}\nDelivered: ${stats.delivered}\nFailed: ${stats.failed}`,
  });
}
