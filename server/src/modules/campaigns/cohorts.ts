import prisma from '../../config/database';
import { isWithin24HourWindow } from '../whatsapp/meta.service';
import { isSamePhoneIdentity, normalizePhoneIdentity } from '../../utils/phone';
import { AppError } from '../../utils/response';
import { hasAuditableCampaignConsent } from './recipients';

export const COHORT_KINDS = [
  'read',
  'delivered_unread',
  'replied',
  'window',
  'failed',
  'no_reply',
] as const;

export type CohortKind = (typeof COHORT_KINDS)[number];

export function isCohortKind(value: string): value is CohortKind {
  return (COHORT_KINDS as readonly string[]).includes(value);
}

export function recipientMatchesStatusCohort(kind: CohortKind, status: string): boolean {
  if (kind === 'read') return status === 'READ';
  if (kind === 'delivered_unread') return status === 'DELIVERED';
  if (kind === 'failed') return status === 'FAILED';
  if (kind === 'no_reply') return status === 'SENT' || status === 'DELIVERED' || status === 'READ';
  return false;
}

export function canRetryRecipientStatus(status: string): boolean {
  return status === 'FAILED';
}

type RecipientRow = {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: Date | null;
};

async function latestRecipients(campaignId: string): Promise<RecipientRow[]> {
  const latestGeneration = await prisma.campaignRecipient.aggregate({
    where: { campaignId },
    _max: { runGeneration: true },
  });
  return prisma.campaignRecipient.findMany({
    where: { campaignId, runGeneration: latestGeneration._max.runGeneration ?? 0 },
    select: {
      id: true,
      phone: true,
      name: true,
      status: true,
      errorMessage: true,
      sentAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}

async function loadCampaign(campaignId: string, orgId: string, whatsappNumberId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId: orgId, whatsappNumberId },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      whatsappNumberId: true,
      organizationId: true,
    },
  });
  if (!campaign || !campaign.whatsappNumberId) return null;
  return campaign;
}

async function conversationIndex(
  orgId: string,
  whatsappNumberId: string,
  phones: string[]
) {
  const normalized = [...new Set(phones.map((phone) => normalizePhoneIdentity(phone)).filter(Boolean))];
  if (!normalized.length) return new Map<string, { id: string; windowOpen: boolean }>();
  const lastTens = [
    ...new Set(normalized.filter((phone) => phone.length >= 10).map((phone) => phone.slice(-10))),
  ].slice(0, 80);
  const rows = await prisma.conversation.findMany({
    where: {
      organizationId: orgId,
      whatsappNumberId,
      contact: {
        OR: [
          { normalizedPhone: { in: normalized } },
          ...lastTens.map((tail) => ({ normalizedPhone: { endsWith: tail } })),
        ],
      },
    },
    select: {
      id: true,
      cs24hWindowOpensAt: true,
      contact: { select: { normalizedPhone: true } },
    },
  });
  const map = new Map<string, { id: string; windowOpen: boolean }>();
  for (const row of rows) {
    const contactPhone = row.contact?.normalizedPhone;
    if (!contactPhone) continue;
    const value = {
      id: row.id,
      windowOpen: isWithin24HourWindow(row.cs24hWindowOpensAt),
    };
    map.set(contactPhone, value);
    for (const phone of normalized) {
      if (isSamePhoneIdentity(contactPhone, phone)) map.set(phone, value);
    }
  }
  return map;
}

async function inboundTimesByPhone(
  orgId: string,
  whatsappNumberId: string,
  phones: string[],
  after: Date
): Promise<Map<string, number[]>> {
  const normalized = [...new Set(phones.map((phone) => normalizePhoneIdentity(phone)).filter(Boolean))];
  if (!normalized.length) return new Map();
  const inbound = await prisma.message.findMany({
    where: {
      direction: 'INBOUND',
      createdAt: { gt: after },
      conversation: {
        organizationId: orgId,
        whatsappNumberId,
        contact: { normalizedPhone: { in: normalized } },
      },
    },
    select: {
      createdAt: true,
      conversation: { select: { contact: { select: { normalizedPhone: true } } } },
    },
  });
  const map = new Map<string, number[]>();
  for (const row of inbound) {
    const phone = row.conversation?.contact?.normalizedPhone;
    if (!phone) continue;
    const times = map.get(phone) || [];
    times.push(row.createdAt.getTime());
    map.set(phone, times);
  }
  return map;
}

export function recipientRepliedAfterOwnSend(
  sentAt: Date | null,
  createdAt: Date,
  inboundTimes: number[] | undefined
): boolean {
  if (!inboundTimes?.length) return false;
  const after = (sentAt ?? createdAt).getTime();
  return inboundTimes.some((time) => time > after);
}

function campaignStart(recipients: RecipientRow[], createdAt: Date): Date {
  const sentTimes = recipients
    .map((row) => row.sentAt?.getTime())
    .filter((value): value is number => typeof value === 'number');
  if (!sentTimes.length) return createdAt;
  return new Date(Math.min(...sentTimes));
}

export async function getCampaignCohortCounts(
  campaignId: string,
  orgId: string,
  whatsappNumberId?: string
) {
  if (!whatsappNumberId) throw new AppError(409, 'Select a WhatsApp number');
  const campaign = await loadCampaign(campaignId, orgId, whatsappNumberId);
  if (!campaign) return null;
  const recipients = await latestRecipients(campaignId);
  const byStatus: Record<string, number> = {};
  for (const row of recipients) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
  }
  const phones = recipients.map((row) => row.phone);
  const after = campaignStart(recipients, campaign.createdAt);
  const [inbound, conversations] = await Promise.all([
    inboundTimesByPhone(orgId, whatsappNumberId, phones, after),
    conversationIndex(orgId, whatsappNumberId, phones),
  ]);
  let windowCount = 0;
  let noReply = 0;
  const repliedPhones = new Set<string>();
  for (const row of recipients) {
    const phone = normalizePhoneIdentity(row.phone);
    if (conversations.get(phone)?.windowOpen) windowCount += 1;
    const replied = recipientRepliedAfterOwnSend(
      row.sentAt,
      campaign.createdAt,
      inbound.get(phone)
    );
    if (replied) repliedPhones.add(phone);
    if (recipientMatchesStatusCohort('no_reply', row.status) && !replied) noReply += 1;
  }
  return {
    campaign: { id: campaign.id, name: campaign.name, status: campaign.status },
    counts: {
      total: recipients.length,
      read: byStatus.READ || 0,
      deliveredUnread: byStatus.DELIVERED || 0,
      failed: byStatus.FAILED || 0,
      ambiguous: byStatus.AMBIGUOUS || 0,
      pending: byStatus.PENDING || 0,
      sent: byStatus.SENT || 0,
      replied: repliedPhones.size,
      window: windowCount,
      noReply,
    },
  };
}

export async function listCampaignCohort(
  campaignId: string,
  orgId: string,
  kind: CohortKind,
  whatsappNumberId?: string,
  page = 1,
  limit = 50
) {
  if (!whatsappNumberId) throw new AppError(409, 'Select a WhatsApp number');
  const campaign = await loadCampaign(campaignId, orgId, whatsappNumberId);
  if (!campaign) return null;
  const recipients = await latestRecipients(campaignId);
  const after = campaignStart(recipients, campaign.createdAt);
  const phones = recipients.map((row) => row.phone);
  const needsInbound = kind === 'replied' || kind === 'no_reply';
  const [inbound, conversations] = await Promise.all([
    needsInbound
      ? inboundTimesByPhone(orgId, whatsappNumberId, phones, after)
      : Promise.resolve(new Map<string, number[]>()),
    conversationIndex(orgId, whatsappNumberId, phones),
  ]);

  const matched = recipients.filter((row) => {
    const phone = normalizePhoneIdentity(row.phone);
    const replied = recipientRepliedAfterOwnSend(
      row.sentAt,
      campaign.createdAt,
      inbound.get(phone)
    );
    if (kind === 'replied') return replied;
    if (kind === 'window') return Boolean(conversations.get(phone)?.windowOpen);
    if (kind === 'no_reply') {
      return recipientMatchesStatusCohort('no_reply', row.status) && !replied;
    }
    return recipientMatchesStatusCohort(kind, row.status);
  });

  const take = Math.min(Math.max(limit, 1), 200);
  const skip = (Math.max(page, 1) - 1) * take;
  const pageRows = matched.slice(skip, skip + take).map((row) => {
    const phone = normalizePhoneIdentity(row.phone);
    const conversation = conversations.get(phone);
    return {
      id: row.id,
      phone: row.phone,
      name: row.name,
      status: row.status,
      errorMessage: row.errorMessage,
      conversationId: conversation?.id || null,
      windowOpen: Boolean(conversation?.windowOpen),
    };
  });

  return {
    kind,
    total: matched.length,
    page,
    limit: take,
    recipients: pageRows,
  };
}

export async function getCampaignCohortAudience(
  campaignId: string,
  orgId: string,
  kind: CohortKind,
  whatsappNumberId?: string
) {
  if (!whatsappNumberId) throw new AppError(409, 'Select a WhatsApp number');
  if (kind === 'replied') {
    throw new AppError(400, 'Replied contacts are opened in Inbox, not as a new campaign');
  }
  const campaign = await loadCampaign(campaignId, orgId, whatsappNumberId);
  if (!campaign) return null;
  const recipients = await latestRecipients(campaignId);
  const after = campaignStart(recipients, campaign.createdAt);
  const phones = recipients.map((row) => row.phone);
  const needsInbound = kind === 'no_reply';
  const [inbound, conversations] = await Promise.all([
    needsInbound
      ? inboundTimesByPhone(orgId, whatsappNumberId, phones, after)
      : Promise.resolve(new Map<string, number[]>()),
    conversationIndex(orgId, whatsappNumberId, phones),
  ]);

  const matched = recipients.filter((row) => {
    const phone = normalizePhoneIdentity(row.phone);
    const replied = recipientRepliedAfterOwnSend(
      row.sentAt,
      campaign.createdAt,
      inbound.get(phone)
    );
    if (kind === 'window') return Boolean(conversations.get(phone)?.windowOpen);
    if (kind === 'no_reply') {
      return recipientMatchesStatusCohort('no_reply', row.status) && !replied;
    }
    return recipientMatchesStatusCohort(kind, row.status);
  });

  const identities = [
    ...new Set(matched.map((row) => normalizePhoneIdentity(row.phone)).filter(Boolean)),
  ];
  const contacts = identities.length
    ? await prisma.contact.findMany({
        where: {
          organizationId: orgId,
          whatsappNumberId,
          normalizedPhone: { in: identities },
        },
        select: {
          id: true,
          phone: true,
          normalizedPhone: true,
          optedIn: true,
          consentSource: true,
          consentAt: true,
          optOutAt: true,
        },
      })
    : [];

  const contactIds: string[] = [];
  const seen = new Set<string>();
  let skippedNoContact = 0;
  let skippedNoConsent = 0;
  for (const row of matched) {
    const contact = contacts.find((candidate) =>
      isSamePhoneIdentity(candidate.normalizedPhone || candidate.phone, row.phone)
    );
    if (!contact) {
      skippedNoContact += 1;
      continue;
    }
    if (!hasAuditableCampaignConsent(contact)) {
      skippedNoConsent += 1;
      continue;
    }
    if (seen.has(contact.id)) continue;
    seen.add(contact.id);
    contactIds.push(contact.id);
  }

  return {
    kind,
    whatsappNumberId,
    totalMatched: matched.length,
    contactIds,
    eligible: contactIds.length,
    skippedNoContact,
    skippedNoConsent,
  };
}
