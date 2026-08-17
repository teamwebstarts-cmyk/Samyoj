import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { emitToOrg } from '../../realtime';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('provider-status');

export const PROVIDER_STATUS_RANK: Record<string, number> = {
  PENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 4,
};

export function unmatchedStatusEventAt(timestamp?: Date): Date {
  if (timestamp && !Number.isNaN(timestamp.getTime())) return timestamp;
  return new Date(0);
}

export function shouldApplyProviderStatus(opts: {
  currentStatus: string;
  nextStatus: string;
  existingStatusAt: Date | null;
  eventAt: Date | null;
}): boolean {
  const isOlderOrDuplicate = Boolean(
    opts.eventAt &&
    opts.existingStatusAt &&
    opts.eventAt.getTime() <= opts.existingStatusAt.getTime()
  );
  if (isOlderOrDuplicate) return false;
  const currentRank = PROVIDER_STATUS_RANK[opts.currentStatus] ?? -1;
  const nextRank = PROVIDER_STATUS_RANK[opts.nextStatus] ?? -1;
  if (opts.nextStatus === 'FAILED') {
    return !opts.existingStatusAt || Boolean(opts.eventAt);
  }
  return nextRank >= currentRank;
}

function parseExistingStatusAt(metadata: Record<string, unknown> | null | undefined): Date | null {
  const raw = metadata?.providerStatusAt;
  if (typeof raw !== 'string') return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function persistUnmatchedProviderStatus(input: {
  organizationId: string;
  whatsappNumberId: string;
  metaMessageId: string;
  status: string;
  eventAt?: Date;
  recipientPhone?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const eventAt = unmatchedStatusEventAt(input.eventAt);
  try {
    await prisma.unmatchedProviderStatus.create({
      data: {
        organizationId: input.organizationId,
        whatsappNumberId: input.whatsappNumberId,
        metaMessageId: input.metaMessageId,
        status: input.status,
        recipientPhone: input.recipientPhone ?? null,
        eventAt,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return;
    }
    throw error;
  }
}

export async function applyProviderMessageStatus(input: {
  organizationId: string;
  phoneNumberId: string;
  metaMessageId: string;
  statusValue: string;
  statusTimestamp?: Date;
  status: Record<string, unknown>;
}): Promise<boolean> {
  const existingMsg = await prisma.message.findFirst({
    where: {
      metaMessageId: input.metaMessageId,
      conversation: {
        organizationId: input.organizationId,
        whatsappNumber: { phoneNumberId: input.phoneNumberId },
      },
    },
    select: { id: true, status: true, metadata: true, conversationId: true },
  });
  if (!existingMsg) return false;

  const existingMeta = (existingMsg.metadata as Record<string, unknown>) || {};
  const existingStatusAt = parseExistingStatusAt(existingMeta);
  const hasValidEventTime = Boolean(
    input.statusTimestamp && !Number.isNaN(input.statusTimestamp.getTime())
  );
  const eventAt = hasValidEventTime ? input.statusTimestamp! : null;
  const isOlderOrDuplicate = Boolean(
    eventAt && existingStatusAt && eventAt.getTime() <= existingStatusAt.getTime()
  );
  const shouldUpdateStatus = shouldApplyProviderStatus({
    currentStatus: existingMsg.status,
    nextStatus: input.statusValue,
    existingStatusAt,
    eventAt,
  });

  const statusMeta: Record<string, unknown> = { ...existingMeta };
  if (!isOlderOrDuplicate && input.status.pricing) statusMeta.pricing = input.status.pricing;
  if (!isOlderOrDuplicate && input.status.errors) statusMeta.errors = input.status.errors;
  if (!isOlderOrDuplicate && input.status.conversation) {
    statusMeta.conversationId = (input.status.conversation as { id?: string })?.id;
  }
  if (hasValidEventTime && !isOlderOrDuplicate) {
    statusMeta.providerStatusAt = eventAt!.toISOString();
    statusMeta.providerEventKey = `${input.metaMessageId}:${input.statusValue}:${eventAt!.toISOString()}`;
  }

  await prisma.message.updateMany({
    where: {
      metaMessageId: input.metaMessageId,
      conversation: {
        organizationId: input.organizationId,
        whatsappNumber: { phoneNumberId: input.phoneNumberId },
      },
    },
    data: {
      ...(shouldUpdateStatus ? { status: input.statusValue as never } : {}),
      metadata: statusMeta as Prisma.InputJsonValue,
    },
  });

  if (shouldUpdateStatus) {
    log.info('Message status updated', {
      messageId: existingMsg.id,
      metaMessageId: input.metaMessageId,
      status: input.statusValue,
      organizationId: input.organizationId,
    });
    emitToOrg(input.organizationId, 'message:status', {
      messageId: existingMsg.id,
      status: input.statusValue,
      conversationId: existingMsg.conversationId,
    });
  }
  return true;
}

export async function handleOutboundStatusWebhook(input: {
  organizationId: string;
  whatsappNumberId: string;
  phoneNumberId: string;
  metaMessageId: string;
  statusValue: string;
  statusTimestamp?: Date;
  status: Record<string, unknown>;
}): Promise<void> {
  const { recordWebhookStatusMetaError } = await import('../platform/meta-errors');
  recordWebhookStatusMetaError({
    organizationId: input.organizationId,
    whatsappNumberId: input.whatsappNumberId,
    statusValue: input.statusValue,
    status: input.status,
  });

  const { syncCampaignRecipientFromWebhook } = await import('../campaigns/service');
  await syncCampaignRecipientFromWebhook(input.metaMessageId, input.statusValue, {
    organizationId: input.organizationId,
    phoneNumberId: input.phoneNumberId,
    timestamp: input.statusTimestamp,
    errors: input.status.errors,
  });

  const recipientPhone =
    typeof input.status.recipient_id === 'string' ? input.status.recipient_id : undefined;

  let applied = await applyProviderMessageStatus(input);
  if (applied) return;

  await persistUnmatchedProviderStatus({
    organizationId: input.organizationId,
    whatsappNumberId: input.whatsappNumberId,
    metaMessageId: input.metaMessageId,
    status: input.statusValue,
    eventAt: input.statusTimestamp,
    recipientPhone,
    payload: {
      errors: input.status.errors,
      pricing: input.status.pricing,
      conversation: input.status.conversation,
      recipient_id: recipientPhone,
    },
  });

  applied = await applyProviderMessageStatus(input);
  if (applied) {
    await markUnmatchedApplied(input.organizationId, input.metaMessageId, input.whatsappNumberId);
    return;
  }

  await syncCampaignRecipientFromWebhook(input.metaMessageId, input.statusValue, {
    organizationId: input.organizationId,
    phoneNumberId: input.phoneNumberId,
    timestamp: input.statusTimestamp,
    errors: input.status.errors,
  });
}

async function markUnmatchedApplied(
  organizationId: string,
  metaMessageId: string,
  whatsappNumberId?: string
): Promise<void> {
  await prisma.unmatchedProviderStatus.updateMany({
    where: {
      organizationId,
      metaMessageId,
      appliedAt: null,
      ...(whatsappNumberId ? { whatsappNumberId } : {}),
    },
    data: { appliedAt: new Date() },
  });
}

export async function reconcileUnmatchedProviderStatuses(input: {
  organizationId: string;
  metaMessageId: string;
  whatsappNumberId?: string;
  phoneNumberId?: string;
}): Promise<void> {
  if (!input.metaMessageId) return;

  const pending = await prisma.unmatchedProviderStatus.findMany({
    where: {
      organizationId: input.organizationId,
      metaMessageId: input.metaMessageId,
      appliedAt: null,
      ...(input.whatsappNumberId ? { whatsappNumberId: input.whatsappNumberId } : {}),
    },
    orderBy: { eventAt: 'asc' },
  });
  if (!pending.length) return;

  let phoneNumberId = input.phoneNumberId;
  if (!phoneNumberId && input.whatsappNumberId) {
    const number = await prisma.whatsappNumber.findFirst({
      where: { id: input.whatsappNumberId, organizationId: input.organizationId },
      select: { phoneNumberId: true },
    });
    phoneNumberId = number?.phoneNumberId;
  }

  const { syncCampaignRecipientFromWebhook } = await import('../campaigns/service');
  let appliedAny = false;

  for (const row of pending) {
    const payload = (row.payload as Record<string, unknown>) || {};
    if (phoneNumberId) {
      const applied = await applyProviderMessageStatus({
        organizationId: input.organizationId,
        phoneNumberId,
        metaMessageId: input.metaMessageId,
        statusValue: row.status,
        statusTimestamp: row.eventAt.getTime() === 0 ? undefined : row.eventAt,
        status: payload,
      });
      if (applied) appliedAny = true;
      await syncCampaignRecipientFromWebhook(input.metaMessageId, row.status, {
        organizationId: input.organizationId,
        phoneNumberId,
        timestamp: row.eventAt.getTime() === 0 ? undefined : row.eventAt,
        errors: payload.errors,
      });
    }
  }

  const recipient = await prisma.campaignRecipient.findUnique({
    where: { metaMessageId: input.metaMessageId },
    select: { id: true },
  });
  if (appliedAny || recipient) {
    await markUnmatchedApplied(input.organizationId, input.metaMessageId, input.whatsappNumberId);
  }
}
