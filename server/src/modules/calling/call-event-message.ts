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
