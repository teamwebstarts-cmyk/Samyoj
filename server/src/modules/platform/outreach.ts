import prisma from '../../config/database';
import { sendEmail } from '../../services/email.service';
import { AppError } from '../../utils/response';
import { writePlatformAudit } from './audit';
import { collectOrgHealthMetrics } from './snapshots';

export const OUTREACH_TEMPLATE_IDS = [
  'connect_whatsapp',
  'add_contacts',
  'first_send',
  'inbound_stuck',
  'trial_ending',
  'quality_risk',
] as const;

export type OutreachTemplateId = (typeof OUTREACH_TEMPLATE_IDS)[number];

const TEMPLATE_COPY: Record<
  OutreachTemplateId,
  { subject: string; body: (companyName: string) => string }
> = {
  connect_whatsapp: {
    subject: 'Connect WhatsApp to finish Samyoj setup',
    body: (companyName) =>
      `Hi ${companyName},\n\nYour Samyoj account is ready. Connect WhatsApp so Inbox, campaigns, and calling can go live.\n\nOpen Settings → WhatsApp in Samyoj and complete Connect WhatsApp.\n\n— Samyoj`,
  },
  add_contacts: {
    subject: 'Add your first contacts in Samyoj',
    body: (companyName) =>
      `Hi ${companyName},\n\nWhatsApp is connected, but this workspace has no contacts yet. Add one contact or import a CSV to start messaging.\n\n— Samyoj`,
  },
  first_send: {
    subject: 'Send your first WhatsApp message',
    body: (companyName) =>
      `Hi ${companyName},\n\nYou have contacts in Samyoj but no outbound messages yet. Send a template from Inbox or start a campaign.\n\n— Samyoj`,
  },
  inbound_stuck: {
    subject: 'Replies are not arriving in Samyoj',
    body: (companyName) =>
      `Hi ${companyName},\n\nSamyoj has outbound messages but no inbound replies yet. That is often a webhook or Connect issue, not a missed follow-up. Reply to this email if you want us to check the connection.\n\n— Samyoj`,
  },
  trial_ending: {
    subject: 'Your Samyoj plan needs attention',
    body: (companyName) =>
      `Hi ${companyName},\n\nYour Samyoj plan is expired, past due, or a payment failed. Open Billing in Samyoj to renew. WhatsApp message fees stay on your Meta bill separately.\n\n— Samyoj`,
  },
  quality_risk: {
    subject: 'WhatsApp quality needs attention',
    body: (companyName) =>
      `Hi ${companyName},\n\nA connected WhatsApp number is YELLOW or RED. Review quality in WhatsApp Manager and pause marketing bursts until it recovers. This is a Meta quality signal, not a Samyoj upgrade prompt.\n\n— Samyoj`,
  },
};

export function isOutreachTemplateId(value: string): value is OutreachTemplateId {
  return (OUTREACH_TEMPLATE_IDS as readonly string[]).includes(value);
}

export async function resolveOrgOwnerEmail(organizationId: string): Promise<{
  email: string;
  companyName: string;
} | null> {
  const owner = await prisma.organizationUser.findFirst({
    where: { organizationId, role: 'OWNER' },
    select: {
      user: { select: { email: true } },
      organization: { select: { companyName: true } },
    },
  });
  const email = owner?.user.email?.trim();
  if (!email || !owner) return null;
  return { email, companyName: owner.organization.companyName };
}

export async function sendOrgOutreach(input: {
  organizationId: string;
  operatorId: string;
  templateId: string;
  reason: string;
}): Promise<{ id: string; status: 'SENT' | 'FAILED'; templateId: OutreachTemplateId }> {
  if (!isOutreachTemplateId(input.templateId)) {
    throw new AppError(400, 'Unknown outreach template');
  }

  const owner = await resolveOrgOwnerEmail(input.organizationId);
  if (!owner) {
    throw new AppError(404, 'Organization owner email was not found');
  }

  const template = TEMPLATE_COPY[input.templateId];
  const log = await prisma.outreachLog.create({
    data: {
      organizationId: input.organizationId,
      operatorId: input.operatorId,
      channel: 'EMAIL',
      templateId: input.templateId,
      status: 'QUEUED',
    },
  });

  let status: 'SENT' | 'FAILED' = 'SENT';
  let errorCode: string | null = null;
  try {
    await sendEmail({
      to: owner.email,
      subject: template.subject,
      text: template.body(owner.companyName),
    });
  } catch (error) {
    status = 'FAILED';
    errorCode = error instanceof Error ? error.message.slice(0, 80) : 'SEND_FAILED';
  }

  await prisma.outreachLog.update({
    where: { id: log.id },
    data: {
      status,
      errorCode,
      sentAt: status === 'SENT' ? new Date() : null,
    },
  });

  await writePlatformAudit({
    operatorId: input.operatorId,
    action: 'PLATFORM_OUTREACH_SENT',
    organizationId: input.organizationId,
    targetType: 'OutreachLog',
    targetId: log.id,
    reason: input.reason,
    afterState: { templateId: input.templateId, status },
  });

  return { id: log.id, status, templateId: input.templateId };
}

export async function listOutreachQueues(now = new Date()) {
  const orgs = await prisma.organization.findMany({
    select: { id: true, companyName: true, createdAt: true },
  });
  const queues: Record<string, Array<{ id: string; companyName: string; stage: string }>> = {
    connect_whatsapp: [],
    add_contacts: [],
    first_send: [],
    inbound_stuck: [],
    trial_ending: [],
    quality_risk: [],
  };

  for (const org of orgs) {
    const metrics = await collectOrgHealthMetrics(org.id, now);
    if (!metrics) continue;
    const row = { id: org.id, companyName: org.companyName, stage: metrics.stage };
    if (metrics.stage === 'NOT_CONNECTED' || metrics.stage === 'REGISTERED') {
      queues.connect_whatsapp.push(row);
    } else if (metrics.stage === 'CONNECTED_EMPTY') {
      queues.add_contacts.push(row);
    } else if (metrics.stage === 'CONTACTS_READY') {
      queues.first_send.push(row);
    } else if (metrics.stage === 'OUTBOUND_ONLY' || metrics.webhookStale) {
      queues.inbound_stuck.push(row);
    }
    if (metrics.billingRisk) queues.trial_ending.push(row);
    if (metrics.qualityRisk) queues.quality_risk.push(row);
  }

  return {
    templates: OUTREACH_TEMPLATE_IDS,
    queues,
  };
}
