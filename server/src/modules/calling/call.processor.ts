import prisma from '../../config/database';
import { config } from '../../config';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { emitToOrg } from '../../realtime';
import { resolveBotForConversation, ensureDefaultBot } from '../ai/bot.service';
import { createModuleLogger } from '../../utils/logger';
import { AiVoiceCallSession } from './ai-voice-agent';
import {
  endCallSession,
  getCallSession,
  registerCallSession,
  removeCallSession,
} from './call-session.manager';
import { isCallingConfigured, MetaCallingService } from './meta-calling.service';
import type { CallWebhookEntry } from './types';

const log = createModuleLogger('call-processor');

async function ensureContactAndConversation(
  orgId: string,
  whatsappNumberId: string,
  contactPhone: string
) {
  let contact = await prisma.contact.findUnique({
    where: { organizationId_phone: { organizationId: orgId, phone: contactPhone } },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: { organizationId: orgId, phone: contactPhone, optedIn: true },
    });
  }

  let conversation = await prisma.conversation.findFirst({
    where: { organizationId: orgId, contactId: contact.id },
    orderBy: { lastMessageAt: 'desc' },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        organizationId: orgId,
        contactId: contact.id,
        whatsappNumberId,
        status: 'OPEN',
        botActive: true,
      },
    });
  }

  return { contact, conversation };
}

async function handleCallConnect(
  orgId: string,
  whatsappNumberId: string,
  phoneNumberId: string,
  accessToken: string,
  businessPhone: string,
  call: CallWebhookEntry
): Promise<void> {
  const metaCallId = call.id;
  const fromPhone = call.from || '';
  const toPhone = call.to || '';
  const direction = call.direction || 'USER_INITIATED';
  const sdpOffer = call.session?.sdp;

  if (!sdpOffer) {
    log.warn('Call connect webhook missing SDP offer', { metaCallId });
    return;
  }

  const normalize = (p: string) => p.replace(/\D/g, '');
  const businessDigits = normalize(businessPhone);
  const contactPhone =
    normalize(fromPhone) === businessDigits || normalize(fromPhone).endsWith(businessDigits)
      ? toPhone
      : fromPhone;
  const { contact, conversation } = await ensureContactAndConversation(
    orgId,
    whatsappNumberId,
    contactPhone
  );

  const bot = (await resolveBotForConversation(orgId, conversation, '')) ?? (await ensureDefaultBot(orgId));

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      botActive: true,
      activeBotId: bot.id,
    },
  });

  const callRecord = await prisma.call.upsert({
    where: { metaCallId },
    create: {
      organizationId: orgId,
      contactId: contact.id,
      conversationId: conversation.id,
      whatsappNumberId,
      aiBotId: bot?.id,
      metaCallId,
      direction,
      status: 'CONNECTING',
      handler: config.calling.aiAutoAnswer && isCallingConfigured() ? 'AI' : 'UNANSWERED',
      fromPhone,
      toPhone,
    },
    update: {
      status: 'CONNECTING',
      conversationId: conversation.id,
    },
  });

  emitToOrg(orgId, 'call:incoming', {
    callId: callRecord.id,
    metaCallId,
    fromPhone,
    toPhone,
    direction,
    contactName: contact.name,
    conversationId: conversation.id,
    status: 'CONNECTING',
  });

  if (!config.calling.aiAutoAnswer || !isCallingConfigured()) {
    log.info('AI auto-answer disabled or calling not configured', { metaCallId });
    await prisma.call.update({
      where: { id: callRecord.id },
      data: { status: 'MISSED', handler: 'UNANSWERED', endedAt: new Date() },
    });
    emitToOrg(orgId, 'call:updated', { callId: callRecord.id, status: 'MISSED' });
    return;
  }

  const session = new AiVoiceCallSession({
    callId: callRecord.id,
    metaCallId,
    organizationId: orgId,
    conversationId: conversation.id,
    contactId: contact.id,
    phoneNumberId,
    accessToken,
    fromPhone,
    toPhone,
    direction,
    aiBotId: bot.id,
  });

  registerCallSession(metaCallId, session);

  try {
    await session.start(sdpOffer);
    emitToOrg(orgId, 'call:updated', {
      callId: callRecord.id,
      status: 'CONNECTED',
      handler: 'AI',
    });
  } catch (err) {
    log.error('Failed to start AI voice session', {
      metaCallId,
      error: err instanceof Error ? err.message : String(err),
    });
    removeCallSession(metaCallId);
    session.dispose();
    await prisma.call.update({
      where: { id: callRecord.id },
      data: { status: 'FAILED', endedAt: new Date() },
    });
    emitToOrg(orgId, 'call:updated', { callId: callRecord.id, status: 'FAILED' });
    try {
      await MetaCallingService.reject(phoneNumberId, accessToken, metaCallId);
    } catch {
      // ignore
    }
  }
}

async function handleCallTerminate(
  orgId: string,
  call: CallWebhookEntry
): Promise<void> {
  const metaCallId = call.id;
  const existing = await prisma.call.findUnique({ where: { metaCallId } });
  if (!existing) return;

  const session = getCallSession(metaCallId);
  if (session) {
    await endCallSession(metaCallId, 'remote_terminate').catch(() => undefined);
  }

  const duration =
    typeof call.duration === 'number'
      ? call.duration
      : call.start_time && call.end_time
        ? Math.max(0, Number(call.end_time) - Number(call.start_time))
        : undefined;

  const statusRaw = call.status?.[0]?.toLowerCase();
  let status: 'COMPLETED' | 'FAILED' | 'MISSED' | 'TERMINATED' = 'TERMINATED';
  if (statusRaw === 'completed') status = 'COMPLETED';
  else if (statusRaw === 'failed') status = 'FAILED';

  await prisma.call.update({
    where: { id: existing.id },
    data: {
      status,
      endedAt: new Date(),
      durationSeconds: duration,
      startedAt: call.start_time ? new Date(Number(call.start_time) * 1000) : existing.startedAt,
    },
  });

  emitToOrg(orgId, 'call:updated', {
    callId: existing.id,
    status,
    durationSeconds: duration,
  });

  log.info('Call terminated', { metaCallId, status, duration });
}

export async function processCallWebhookPayload(payload: Record<string, unknown>): Promise<void> {
  if (payload.object !== 'whatsapp_business_account') return;

  for (const entry of (payload.entry as Array<Record<string, unknown>>) || []) {
    for (const change of (entry.changes as Array<Record<string, unknown>>) || []) {
      if (change.field !== 'calls') continue;

      const value = change.value as Record<string, unknown>;
      const metadata = value.metadata as { phone_number_id?: string } | undefined;
      const phoneNumberId = metadata?.phone_number_id;

      const whatsappNumber = await prisma.whatsappNumber.findFirst({
        where: { phoneNumberId, isActive: true },
      });
      if (!whatsappNumber) {
        log.warn('No WhatsApp number for call webhook', { phoneNumberId });
        continue;
      }

      const orgId = whatsappNumber.organizationId;
      const accessToken = MetaWhatsAppService.decryptToken(whatsappNumber.accessToken);

      for (const call of (value.calls as CallWebhookEntry[]) || []) {
        const event = call.event?.toLowerCase();
        log.info('Processing call webhook', { event, metaCallId: call.id, orgId });

        if (event === 'connect') {
          // Run outside the webhook job so BullMQ does not mark long voice setup as stalled.
          void handleCallConnect(
            orgId,
            whatsappNumber.id,
            phoneNumberId!,
            accessToken,
            whatsappNumber.phoneNumber,
            call
          ).catch((err) => {
            log.error('Call connect handler failed', {
              metaCallId: call.id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
        } else if (event === 'terminate') {
          await endCallSession(call.id, 'remote_terminate').catch(() => undefined);
          await handleCallTerminate(orgId, call);
        }
      }
    }
  }
}

export async function processWebhookFields(payload: Record<string, unknown>): Promise<void> {
  const fields = new Set<string>();
  for (const entry of (payload.entry as Array<Record<string, unknown>>) || []) {
    for (const change of (entry.changes as Array<Record<string, unknown>>) || []) {
      if (typeof change.field === 'string') fields.add(change.field);
    }
  }

  if (fields.has('messages')) {
    const { processWebhookPayload } = await import('../../workers/webhook.processor');
    await processWebhookPayload(payload);
  }

  if (fields.has('calls')) {
    await processCallWebhookPayload(payload);
  }
}
