import prisma from '../../config/database';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { emitToOrg, emitToUser, emitToUsers } from '../../realtime';
import { createModuleLogger } from '../../utils/logger';
import { AiVoiceCallSession } from './ai-voice-agent';
import {
  endCallSession,
  getCallSession,
  registerCallSession,
  removeCallSession,
} from './call-session.manager';
import { isCallingConfigured, MetaCallingService } from './meta-calling.service';
import { decideCallRoute, resolveCallBot } from './routing.service';
import { getOrgCallingSettings, resolveEffectiveVoiceConfig } from './settings.service';
import { triggerCallCompletedFlow } from '../flows/engine';
import { handleMissedCallFollowUp } from './missed-call.service';
import { publishCallEventMessage } from './call-event-message';
import {
  getPendingCall,
  registerActiveCall,
  removePendingCall,
  storePendingCall,
  storePendingCallWithTtl,
  unregisterActiveCall,
} from './session-store';
import type { CallWebhookEntry } from './types';

const log = createModuleLogger('call-processor');

const ringTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

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
      data: { organizationId: orgId, phone: contactPhone, optedIn: true, source: 'INBOUND' },
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
  } else if (!conversation.whatsappNumberId) {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { whatsappNumberId },
    });
  }

  return { contact, conversation };
}

async function markCallMissed(
  orgId: string,
  callId: string,
  conversationId: string | null,
  contactId: string,
  reason: string,
  customMessage?: string
): Promise<void> {
  await prisma.call.update({
    where: { id: callId },
    data: { status: 'MISSED', handler: 'UNANSWERED', endedAt: new Date() },
  });

  emitToOrg(orgId, 'call:updated', { callId, status: 'MISSED', reason });
  void publishCallEventMessage(callId);

  void handleMissedCallFollowUp({
    organizationId: orgId,
    callId,
    conversationId,
    contactId,
    customMessage,
  });
}

async function startAiSession(params: {
  orgId: string;
  callRecord: { id: string; metaCallId: string };
  conversation: { id: string };
  contact: { id: string };
  phoneNumberId: string;
  accessToken: string;
  whatsappNumberId?: string;
  fromPhone: string;
  toPhone: string;
  direction: string;
  botId: string;
  sdpOffer: string;
  consentMessage?: string;
  greeting?: string;
  ttsVoice?: string;
  ttsLanguage?: string;
  sttPrompt?: string;
  sttMode?: string;
  sttLanguage?: string;
}): Promise<void> {
  const session = new AiVoiceCallSession({
    callId: params.callRecord.id,
    metaCallId: params.callRecord.metaCallId,
    organizationId: params.orgId,
    conversationId: params.conversation.id,
    contactId: params.contact.id,
    phoneNumberId: params.phoneNumberId,
    accessToken: params.accessToken,
    whatsappNumberId: params.whatsappNumberId,
    fromPhone: params.fromPhone,
    toPhone: params.toPhone,
    direction: params.direction as 'USER_INITIATED' | 'BUSINESS_INITIATED',
    aiBotId: params.botId,
    greeting: params.greeting,
    consentMessage: params.consentMessage,
    ttsVoice: params.ttsVoice,
    ttsLanguage: params.ttsLanguage,
    sttPrompt: params.sttPrompt,
    sttMode: params.sttMode,
    sttLanguage: params.sttLanguage,
  });

  registerCallSession(params.callRecord.metaCallId, session);
  await registerActiveCall(params.callRecord.metaCallId, params.orgId);

  try {
    await session.start(params.sdpOffer);
    emitToOrg(params.orgId, 'call:updated', {
      callId: params.callRecord.id,
      status: 'CONNECTED',
      handler: 'AI',
    });
  } catch (err) {
    log.error('Failed to start AI voice session', {
      metaCallId: params.callRecord.metaCallId,
      error: err instanceof Error ? err.message : String(err),
    });
    removeCallSession(params.callRecord.metaCallId);
    await unregisterActiveCall(params.callRecord.metaCallId, params.orgId);
    session.dispose();
    await prisma.call.update({
      where: { id: params.callRecord.id },
      data: { status: 'FAILED', endedAt: new Date() },
    });
    emitToOrg(params.orgId, 'call:updated', {
      callId: params.callRecord.id,
      status: 'FAILED',
    });
    void publishCallEventMessage(params.callRecord.id);
    try {
      await MetaCallingService.reject(
        params.phoneNumberId,
        params.accessToken,
        params.callRecord.metaCallId
      );
    } catch {
      // ignore
    }
  }
}

function clearRingTimeout(metaCallId: string): void {
  const timer = ringTimeouts.get(metaCallId);
  if (timer) {
    clearTimeout(timer);
    ringTimeouts.delete(metaCallId);
  }
}

async function ringAgentsForCall(params: {
  orgId: string;
  callRecord: { id: string; metaCallId: string };
  conversation: { id: string };
  contact: { id: string; name?: string | null };
  phoneNumberId: string;
  whatsappNumberId?: string;
  accessToken: string;
  fromPhone: string;
  toPhone: string;
  direction: string;
  sdpOffer: string;
  agentIds: string[];
  timeoutSec: number;
  botId: string;
  settings: Awaited<ReturnType<typeof getOrgCallingSettings>>;
}): Promise<void> {
  await storePendingCallWithTtl(params.callRecord.metaCallId, {
    callId: params.callRecord.id,
    metaCallId: params.callRecord.metaCallId,
    organizationId: params.orgId,
    conversationId: params.conversation.id,
    contactId: params.contact.id,
    phoneNumberId: params.phoneNumberId,
    whatsappNumberId: params.whatsappNumberId,
    fromPhone: params.fromPhone,
    toPhone: params.toPhone,
    direction: params.direction as 'USER_INITIATED' | 'BUSINESS_INITIATED',
    sdpOffer: params.sdpOffer,
    createdAt: new Date().toISOString(),
  }, params.timeoutSec);

  await prisma.call.update({
    where: { id: params.callRecord.id },
    data: { status: 'RINGING', handler: 'UNANSWERED' },
  });

  const ringPayload = {
    callId: params.callRecord.id,
    metaCallId: params.callRecord.metaCallId,
    fromPhone: params.fromPhone,
    contactName: params.contact.name,
    conversationId: params.conversation.id,
    timeoutSec: params.timeoutSec,
    agentIds: params.agentIds,
  };

  emitToOrg(params.orgId, 'call:ring', ringPayload);
  emitToUsers(params.agentIds, 'call:ring', ringPayload);

  clearRingTimeout(params.callRecord.metaCallId);

  const timer = setTimeout(() => {
    void (async () => {
      ringTimeouts.delete(params.callRecord.metaCallId);
      const current = await prisma.call.findUnique({ where: { id: params.callRecord.id } });
      if (!current || current.status !== 'RINGING') return;

      await removePendingCall(params.callRecord.metaCallId);

      if (params.settings.aiAutoAnswer && isCallingConfigured()) {
        emitToOrg(params.orgId, 'call:ring_timeout', { callId: params.callRecord.id });
        await startAiSession({
          orgId: params.orgId,
          callRecord: params.callRecord,
          conversation: params.conversation,
          contact: params.contact,
          phoneNumberId: params.phoneNumberId,
          accessToken: params.accessToken,
          whatsappNumberId: params.whatsappNumberId,
          fromPhone: params.fromPhone,
          toPhone: params.toPhone,
          direction: params.direction,
          botId: params.botId,
          sdpOffer: params.sdpOffer,
          consentMessage: params.settings.recordingConsentEnabled
            ? params.settings.recordingConsentMessage
            : undefined,
          greeting: resolveEffectiveVoiceConfig(params.settings).aiGreeting,
          ttsVoice: resolveEffectiveVoiceConfig(params.settings).ttsVoice,
          ttsLanguage: resolveEffectiveVoiceConfig(params.settings).ttsLanguage,
          sttPrompt: resolveEffectiveVoiceConfig(params.settings).sarvamSttPrompt || undefined,
          sttMode: resolveEffectiveVoiceConfig(params.settings).sarvamMode,
          sttLanguage: resolveEffectiveVoiceConfig(params.settings).sarvamSttLanguage || undefined,
        });
        return;
      }

      await markCallMissed(
        params.orgId,
        params.callRecord.id,
        params.conversation.id,
        params.contact.id,
        'agent_ring_timeout'
      );
    })().catch((err) => {
      log.error('Ring timeout handler failed', {
        callId: params.callRecord.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, params.timeoutSec * 1000);

  ringTimeouts.set(params.callRecord.metaCallId, timer);
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
  const sessionSdp = call.session?.sdp;

  if (call.biz_opaque_callback_data) {
    const linked = await prisma.call.findFirst({
      where: { id: call.biz_opaque_callback_data, organizationId: orgId },
    });
    if (linked && linked.metaCallId.startsWith('pending-') && linked.metaCallId !== metaCallId) {
      await prisma.call.update({
        where: { id: linked.id },
        data: { metaCallId },
      });
    }
  }

  const existingCall = await prisma.call.findUnique({ where: { metaCallId } });
  if (
    existingCall &&
    existingCall.direction === 'BUSINESS_INITIATED' &&
    existingCall.handler === 'AGENT'
  ) {
    const sdpAnswer = call.session?.sdp_type === 'answer' ? sessionSdp : undefined;
    const pending = await getPendingCall(metaCallId);

    if (pending && sdpAnswer) {
      await storePendingCall(metaCallId, { ...pending, sdpAnswer });

      // Tell the calling agent's browser: "customer answered, here's their SDP answer".
      // The agent's browser will set this as the remote description to complete WebRTC.
      // Use emitToUser for the assigned agent (guaranteed) AND emitToOrg as backup.
      if (existingCall.assignedAgentId) {
        emitToUser(existingCall.assignedAgentId, 'call:outbound_connected', {
          callId: existingCall.id,
          metaCallId,
          sdpAnswer,
        });
      }
      emitToOrg(orgId, 'call:outbound_connected', {
        callId: existingCall.id,
        metaCallId,
        sdpAnswer,
        sdpOffer: pending.sdpOffer,
      });
    }

    await prisma.call.update({
      where: { id: existingCall.id },
      data: { status: 'CONNECTED', answeredAt: new Date(), startedAt: new Date() },
    });

    await registerActiveCall(metaCallId, orgId);

    emitToOrg(orgId, 'call:updated', {
      callId: existingCall.id,
      status: 'CONNECTED',
      metaCallId,
    });
    log.info('Outbound agent call connected', { metaCallId, callId: existingCall.id });
    return;
  }

  if (!sessionSdp) {
    log.warn('Call connect webhook missing SDP', { metaCallId, direction });
    return;
  }

  const sdpOffer = sessionSdp;

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

  const settings = await getOrgCallingSettings(orgId);
  const bot = await resolveCallBot(orgId, settings, conversation.id);

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { botActive: true, activeBotId: bot.id },
  });

  const callRecord = await prisma.call.upsert({
    where: { metaCallId },
    create: {
      organizationId: orgId,
      contactId: contact.id,
      conversationId: conversation.id,
      whatsappNumberId,
      aiBotId: bot.id,
      metaCallId,
      direction,
      status: 'CONNECTING',
      handler: 'UNANSWERED',
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

  const route = await decideCallRoute(orgId);

  if (route.mode === 'missed') {
    log.info('Call routed to missed', { metaCallId, reason: route.reason });
    try {
      await MetaCallingService.reject(phoneNumberId, accessToken, metaCallId);
    } catch {
      // ignore
    }
    await markCallMissed(
      orgId,
      callRecord.id,
      conversation.id,
      contact.id,
      route.reason,
      route.afterHoursMessage
    );
    return;
  }

  if (route.mode === 'ring_agents') {
    log.info('Ringing agents for call', { metaCallId, agents: route.agentIds.length });
    await ringAgentsForCall({
      orgId,
      callRecord,
      conversation,
      contact,
      phoneNumberId,
      whatsappNumberId,
      accessToken,
      fromPhone,
      toPhone,
      direction,
      sdpOffer,
      agentIds: route.agentIds,
      timeoutSec: settings.agentRingTimeoutSec,
      botId: bot.id,
      settings,
    });
    return;
  }

  if (!isCallingConfigured()) {
    log.info('Calling pipeline not configured', { metaCallId });
    await markCallMissed(orgId, callRecord.id, conversation.id, contact.id, 'not_configured');
    return;
  }

  const voice = resolveEffectiveVoiceConfig(settings);

  await startAiSession({
    orgId,
    callRecord,
    conversation,
    contact,
    phoneNumberId,
    accessToken,
    whatsappNumberId,
    fromPhone,
    toPhone,
    direction,
    botId: bot.id,
    sdpOffer,
    consentMessage: settings.recordingConsentEnabled
      ? settings.recordingConsentMessage
      : undefined,
    greeting: voice.aiGreeting,
    ttsVoice: voice.ttsVoice,
    ttsLanguage: voice.ttsLanguage,
    sttPrompt: voice.sarvamSttPrompt || undefined,
    sttMode: voice.sarvamMode,
    sttLanguage: voice.sarvamSttLanguage || undefined,
  });
}

async function handleCallTerminate(orgId: string, call: CallWebhookEntry): Promise<void> {
  const metaCallId = call.id;
  const existing = await prisma.call.findUnique({ where: { metaCallId } });
  if (!existing) return;

  clearRingTimeout(metaCallId);
  await removePendingCall(metaCallId);

  const session = getCallSession(metaCallId);
  if (session) {
    await endCallSession(metaCallId, 'remote_terminate').catch(() => undefined);
  }

  await unregisterActiveCall(metaCallId, orgId);

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
  // Also notify the assigned agent directly — Socket.IO may have dropped
  // during page navigation, so emitToUser gives them a guaranteed path.
  if (existing.assignedAgentId) {
    emitToUser(existing.assignedAgentId, 'call:updated', {
      callId: existing.id,
      status,
      durationSeconds: duration,
    });
  }
  void publishCallEventMessage(existing.id);

  if (existing.status === 'RINGING' && status === 'TERMINATED') {
    void handleMissedCallFollowUp({
      organizationId: orgId,
      callId: existing.id,
      conversationId: existing.conversationId,
      contactId: existing.contactId,
    });
  }

  if (status === 'COMPLETED' && existing.conversationId) {
    const contact = await prisma.contact.findUnique({ where: { id: existing.contactId } });
    const whatsappNumber = await prisma.whatsappNumber.findFirst({
      where: { organizationId: orgId, isActive: true },
    });
    if (contact && whatsappNumber) {
      void triggerCallCompletedFlow({
        organizationId: orgId,
        conversationId: existing.conversationId,
        contactId: existing.contactId,
        contactPhone: contact.phone,
        phoneNumberId: whatsappNumber.phoneNumberId,
        encryptedToken: whatsappNumber.accessToken,
      });
    }
  }

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
        } else if (event === 'dtmf') {
          await handleCallDtmf(orgId, call);
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

  const nonMessageFields = [
    'message_template_status_update',
    'phone_number_quality_update',
    'account_alerts',
  ];
  if (nonMessageFields.some((f) => fields.has(f))) {
    const { dispatchNonMessageWebhookFields } = await import('../whatsapp/webhook-dispatcher');
    await dispatchNonMessageWebhookFields(payload);
  }
}

export { clearRingTimeout };

/** Handle DTMF tones sent by the caller during a live call. */
async function handleCallDtmf(orgId: string, call: CallWebhookEntry): Promise<void> {
  const metaCallId = call.id;
  const tone = call.dtmf;
  if (!tone) return;

  const existing = await prisma.call.findUnique({ where: { metaCallId } });
  if (!existing) return;

  log.info('DTMF received', { metaCallId, tone, callId: existing.id });

  // Store DTMF in transcript for visibility
  const session = getCallSession(metaCallId);
  if (session) {
    // The session's internal methods handle transcript updates — we
    // emit a transcript entry directly for DTMF visibility.
    emitToOrg(orgId, 'call:dtmf', {
      callId: existing.id,
      tone,
      at: new Date().toISOString(),
    });
  }

  // Append DTMF to call metadata for analytics/IVR flows
  const metadata = ((existing.metadata as Record<string, unknown>) || {});
  const dtmfHistory = (Array.isArray(metadata.dtmfHistory) ? metadata.dtmfHistory : []) as Array<{ tone: string; at: string }>;
  dtmfHistory.push({ tone, at: new Date().toISOString() });

  await prisma.call.update({
    where: { id: existing.id },
    data: { metadata: { ...metadata, dtmfHistory } },
  });
}

/**
 * Cold live transfer — ring agents on the same Meta call (keep bridge alive).
 * Called after AI handoff when live transfer is enabled in settings.
 */
export async function handleLiveTransfer(params: {
  orgId: string;
  callRecord: { id: string; metaCallId: string };
  conversation: { id: string };
  contact: { id: string; name?: string | null };
  phoneNumberId: string;
  whatsappNumberId?: string;
  accessToken: string;
  fromPhone: string;
  toPhone: string;
  direction: string;
  reason: string;
  transcriptSummary: string;
  botId: string;
  ttsVoice?: string;
  ttsLanguage?: string;
  preferTeam?: string;
}): Promise<void> {
  const { getEligibleAgents } = await import('../team/assignment');
  const agents = await getEligibleAgents(params.orgId);
  const onlineAgents = agents.filter((a) => a.availability === 'ONLINE');

  if (onlineAgents.length === 0) {
    // No agents online — resume AI or fall back to message
    log.info('Live transfer skipped — no online agents', {
      callId: params.callRecord.id,
      reason: params.reason,
    });
    return;
  }

  const settings = await getOrgCallingSettings(params.orgId);
  const agentIds = onlineAgents.map((a) => a.userId);

  await storePendingCall(params.callRecord.metaCallId, {
    callId: params.callRecord.id,
    metaCallId: params.callRecord.metaCallId,
    organizationId: params.orgId,
    conversationId: params.conversation.id,
    contactId: params.contact.id,
    phoneNumberId: params.phoneNumberId,
    whatsappNumberId: params.whatsappNumberId,
    fromPhone: params.fromPhone,
    toPhone: params.toPhone,
    direction: params.direction as 'USER_INITIATED' | 'BUSINESS_INITIATED',
    sdpOffer: '', // bridge already has the SDP; offer not needed for accept on live transfer
    createdAt: new Date().toISOString(),
  });

  const ringPayload = {
    callId: params.callRecord.id,
    metaCallId: params.callRecord.metaCallId,
    fromPhone: params.fromPhone,
    contactName: params.contact.name,
    conversationId: params.conversation.id,
    timeoutSec: settings.agentRingTimeoutSec,
    agentIds,
    reason: params.reason,
    transcriptSummary: params.transcriptSummary,
    isLiveTransfer: true,
  };

  emitToOrg(params.orgId, 'call:ring', ringPayload);
  emitToUsers(agentIds, 'call:ring', ringPayload);

  clearRingTimeout(params.callRecord.metaCallId);

  const timer = setTimeout(() => {
    void (async () => {
      ringTimeouts.delete(params.callRecord.metaCallId);
      const current = await prisma.call.findUnique({ where: { id: params.callRecord.id } });
      if (!current || current.status !== 'RINGING') return;

      await removePendingCall(params.callRecord.metaCallId);

      // Live transfer timed out — the AI session already ended, just mark as missed
      await markCallMissed(
        params.orgId,
        params.callRecord.id,
        params.conversation.id,
        params.contact.id,
        'live_transfer_timeout'
      );
    })().catch((err) => {
      log.error('Live transfer timeout handler failed', {
        callId: params.callRecord.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, settings.agentRingTimeoutSec * 1000);

  ringTimeouts.set(params.callRecord.metaCallId, timer);

  log.info('Live transfer initiated — ringing agents', {
    callId: params.callRecord.id,
    agentCount: agentIds.length,
    reason: params.reason,
  });
}
