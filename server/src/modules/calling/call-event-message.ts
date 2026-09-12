import prisma from '../../config/database';
import { emitToOrg } from '../../realtime';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('call-event');

const TERMINAL: ReadonlySet<string> = new Set([
  'COMPLETED',
  'MISSED',
  'REJECTED',
  'FAILED',
  'TERMINATED',
]);

function formatCallDuration(seconds?: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** WhatsApp-style label for the centered call pill + conversation preview. */
export function describeCallEvent(options: {
  status: string;
  direction: string;
  durationSeconds?: number | null;
}): { label: string; tone: 'missed' | 'completed' | 'failed'; content: string } {
  const duration = formatCallDuration(options.durationSeconds);
  const inbound = options.direction === 'USER_INITIATED';
  const status = options.status.toUpperCase();

  if (status === 'COMPLETED' || (status === 'TERMINATED' && duration)) {
    return {
      label: duration ? `Voice call · ${duration}` : 'Voice call',
      tone: 'completed',
      content: duration ? `Voice call · ${duration}` : 'Voice call',
    };
  }

  if (status === 'FAILED') {
    return { label: 'Voice call failed', tone: 'failed', content: 'Voice call failed' };
  }

  if (status === 'REJECTED') {
    return {
      label: inbound ? 'Missed voice call' : 'No answer',
      tone: 'missed',
      content: inbound ? 'Missed voice call' : 'No answer',
    };
  }

  // MISSED / TERMINATED without a connected duration
  return {
    label: inbound ? 'Missed voice call' : 'No answer',
    tone: 'missed',
    content: inbound ? 'Missed voice call' : 'No answer',
  };
}

/**
 * Upsert a system chat row for a finished WhatsApp call (centered pill in Inbox).
 * Idempotent via metaMessageId = `call:<callId>`.
 */
export async function publishCallEventMessage(callId: string): Promise<void> {
  try {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { conversation: { select: { id: true, organizationId: true, whatsappNumberId: true } } },
    });
    if (!call?.conversationId || !call.conversation) return;
    if (
      call.conversation.organizationId !== call.organizationId ||
      call.conversation.whatsappNumberId !== call.whatsappNumberId
    ) {
      log.warn('Skipping call event for mismatched conversation number', { callId });
      return;
    }
    if (!TERMINAL.has(call.status)) return;

    const desc = describeCallEvent({
      status: call.status,
      direction: call.direction,
      durationSeconds: call.durationSeconds,
    });

    const direction = call.direction === 'BUSINESS_INITIATED' ? 'OUTBOUND' : 'INBOUND';
    const metadata = {
      isCallEvent: true,
      agentOnly: true,
      callId: call.id,
      callStatus: call.status,
      callDirection: call.direction,
      durationSeconds: call.durationSeconds ?? undefined,
      callTone: desc.tone,
    };

    const message = await prisma.message.upsert({
      where: { metaMessageId: `call:${call.id}` },
      create: {
        conversationId: call.conversationId,
        metaMessageId: `call:${call.id}`,
        direction,
        type: 'TEXT',
        content: desc.content,
        status: 'READ',
        metadata,
        createdAt: call.endedAt || call.createdAt,
      },
      update: {
        content: desc.content,
        metadata,
        status: 'READ',
      },
    });

    await prisma.conversation.update({
      where: { id: call.conversationId },
      data: {
        lastMessageAt: message.createdAt,
      },
    });

    emitToOrg(call.organizationId, 'message:new', {
      conversationId: call.conversationId,
      whatsappNumberId: call.whatsappNumberId,
      message,
      conversation: {
        id: call.conversationId,
        lastMessageAt: message.createdAt,
        lastMessage: {
          id: message.id,
          direction: message.direction,
          type: message.type,
          content: message.content,
          status: message.status,
          createdAt: message.createdAt,
        },
      },
    });
  } catch (err) {
    log.warn('Failed to publish call event message', {
      callId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * System chat card for an AI post-call summary (never an inbound customer bubble).
 * Idempotent via metaMessageId = `call-summary:<callId>`.
 */
export async function publishCallSummaryMessage(input: {
  callId: string;
  organizationId: string;
  conversationId: string;
  summary: string;
  createdAt?: Date;
  emit?: boolean;
}): Promise<void> {
  const summary = input.summary.trim();
  if (!summary) return;

  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, organizationId: input.organizationId },
    select: { id: true, whatsappNumberId: true, lastMessageAt: true },
  });
  if (!conversation) return;

  const call = await prisma.call.findUnique({
    where: { id: input.callId },
    select: { whatsappNumberId: true },
  });
  if (
    call?.whatsappNumberId &&
    conversation.whatsappNumberId &&
    call.whatsappNumberId !== conversation.whatsappNumberId
  ) {
    log.warn('Skipping call summary for mismatched conversation number', { callId: input.callId });
    return;
  }

  const metadata = { isCallSummary: true, agentOnly: true, callId: input.callId };

  let createdAt = input.createdAt;
  if (!createdAt) {
    const call = await prisma.call.findUnique({
      where: { id: input.callId },
      select: { endedAt: true, createdAt: true },
    });
    const base = call?.endedAt || call?.createdAt || new Date();
    createdAt = new Date(base.getTime() + 1);
  }

  try {
    const message = await prisma.message.upsert({
    where: { metaMessageId: `call-summary:${input.callId}` },
    create: {
      conversationId: conversation.id,
      metaMessageId: `call-summary:${input.callId}`,
      direction: 'OUTBOUND',
      type: 'TEXT',
      content: summary,
      status: 'READ',
      metadata,
      createdAt,
    },
    update: {
      content: summary,
      metadata,
      status: 'READ',
      createdAt,
    },
  });

  const shouldTouchConversation =
    !conversation.lastMessageAt || message.createdAt >= conversation.lastMessageAt;
  if (shouldTouchConversation) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt },
    });
  }

  if (input.emit === false) return;

  emitToOrg(input.organizationId, 'message:new', {
    conversationId: conversation.id,
    whatsappNumberId: conversation.whatsappNumberId,
    message,
    conversation: {
      id: conversation.id,
      lastMessageAt: shouldTouchConversation ? message.createdAt : conversation.lastMessageAt,
      lastMessage: {
        id: message.id,
        direction: message.direction,
        type: message.type,
        content: message.content,
        status: message.status,
        createdAt: message.createdAt,
      },
    },
  });
  } catch (err) {
    log.warn('Failed to publish call summary message', {
      callId: input.callId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function callMetadataSummary(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const summary = (metadata as { summary?: unknown }).summary;
  if (typeof summary !== 'string') return null;
  const trimmed = summary.trim();
  return trimmed || null;
}

/**
 * Best-effort Inbox cards for older AI calls that have Call.metadata.summary
 * but never got a `call-summary:<id>` message. Fail closed — never breaks GET.
 */
export async function backfillCallSummaryMessages(input: {
  conversationId: string;
  organizationId: string;
  whatsappNumberId?: string | null;
}): Promise<void> {
  try {
    const calls = await prisma.call.findMany({
      where: {
        conversationId: input.conversationId,
        organizationId: input.organizationId,
        ...(input.whatsappNumberId ? { whatsappNumberId: input.whatsappNumberId } : {}),
      },
      select: { id: true, metadata: true, endedAt: true, createdAt: true },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    const withSummary = calls
      .map((call) => ({ call, summary: callMetadataSummary(call.metadata) }))
      .filter((row): row is { call: (typeof calls)[number]; summary: string } => Boolean(row.summary));
    if (withSummary.length === 0) return;

    const existing = await prisma.message.findMany({
      where: {
        conversationId: input.conversationId,
        metaMessageId: { in: withSummary.map(({ call }) => `call-summary:${call.id}`) },
      },
      select: { metaMessageId: true },
    });
    const have = new Set(existing.map((row) => row.metaMessageId));
    await Promise.all(
      withSummary
        .filter(({ call }) => !have.has(`call-summary:${call.id}`))
        .map(({ call, summary }) =>
          publishCallSummaryMessage({
            callId: call.id,
            organizationId: input.organizationId,
            conversationId: input.conversationId,
            summary,
            createdAt: new Date((call.endedAt || call.createdAt).getTime() + 1),
            emit: false,
          })
        )
    );
  } catch (err) {
    log.warn('Failed to backfill call summary messages', {
      conversationId: input.conversationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
