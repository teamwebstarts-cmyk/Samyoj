import prisma from '../../config/database';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { createModuleLogger } from '../../utils/logger';
import { emitToOrg } from '../../realtime';
import { MetaCallingService } from './meta-calling.service';
import {
  getPendingCall,
  getPendingCallByCallId,
  removePendingCall,
  registerActiveCall,
  resolvePendingCallAccessToken,
} from './session-store';
import { publishCallEventMessage } from './call-event-message';

const log = createModuleLogger('agent-call');

export async function acceptCallWithAgentAnswer(params: {
  callId: string;
  agentId: string;
  organizationId: string;
  sdpAnswer: string;
}): Promise<void> {
  const call = await prisma.call.findFirst({
    where: { id: params.callId, organizationId: params.organizationId },
  });
  if (!call) throw new Error('Call not found');
  if (!['RINGING', 'CONNECTING'].includes(call.status)) {
    throw new Error('Call is no longer available to answer');
  }

  const pending =
    (await getPendingCall(call.metaCallId)) ?? (await getPendingCallByCallId(params.callId));
  if (!pending) throw new Error('Call signaling expired — try again on the next call');

  const accessToken = await resolvePendingCallAccessToken(pending);
  if (!accessToken) throw new Error('WhatsApp number no longer available for this call');

  const claimed = await prisma.call.updateMany({
    where: {
      id: call.id,
      organizationId: params.organizationId,
      status: { in: ['RINGING', 'CONNECTING'] },
    },
    data: { status: 'CONNECTING', handler: 'AGENT', assignedAgentId: params.agentId },
  });
  if (claimed.count !== 1) throw new Error('Call is no longer available to answer');

  try {
    await MetaCallingService.preAccept(
      pending.phoneNumberId,
      accessToken,
      pending.metaCallId,
      params.sdpAnswer
    );

    await MetaCallingService.accept(
      pending.phoneNumberId,
      accessToken,
      pending.metaCallId,
      params.sdpAnswer
    );
  } catch (error) {
    await prisma.call.updateMany({
      where: { id: call.id, status: 'CONNECTING', assignedAgentId: params.agentId },
      data: { status: 'RINGING', handler: call.handler, assignedAgentId: null },
    });
    throw error;
  }

  const connected = await prisma.call.updateMany({
    where: { id: call.id, organizationId: params.organizationId, status: 'CONNECTING' },
    data: { status: 'CONNECTED', answeredAt: new Date(), startedAt: new Date() },
  });
  if (connected.count !== 1) throw new Error('Call ended while it was being answered');

  await registerActiveCall(call.metaCallId, params.organizationId);
  await removePendingCall(call.metaCallId);

  emitToOrg(params.organizationId, 'call:updated', {
    callId: call.id,
    status: 'CONNECTED',
    handler: 'AGENT',
    assignedAgentId: params.agentId,
  });

  log.info('Agent answered call', { callId: call.id, agentId: params.agentId });
}

export async function declineCallAsAgent(params: {
  callId: string;
  agentId: string;
  organizationId: string;
}): Promise<void> {
  const call = await prisma.call.findFirst({
    where: { id: params.callId, organizationId: params.organizationId },
  });
  if (!call) return;

  const pending =
    (await getPendingCall(call.metaCallId)) ?? (await getPendingCallByCallId(params.callId));
  if (pending) {
    try {
      const accessToken = await resolvePendingCallAccessToken(pending);
      if (accessToken) {
        await MetaCallingService.reject(
          pending.phoneNumberId,
          accessToken,
          pending.metaCallId
        );
      }
    } catch {
      // Meta may have already ended the call
    }
    await removePendingCall(call.metaCallId);
  }

  const rejected = await prisma.call.updateMany({
    where: {
      id: call.id,
      organizationId: params.organizationId,
      status: 'RINGING',
    },
    data: {
      status: 'REJECTED',
      handler: 'AGENT',
      endedAt: new Date(),
      assignedAgentId: params.agentId,
    },
  });
  if (rejected.count !== 1) return;

  emitToOrg(params.organizationId, 'call:declined', {
    callId: params.callId,
    agentId: params.agentId,
  });
  emitToOrg(params.organizationId, 'call:updated', {
    callId: params.callId,
    status: 'REJECTED',
  });
  void publishCallEventMessage(call.id);

  log.info('Agent declined call', { callId: params.callId, agentId: params.agentId });
}
