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

  await MetaCallingService.preAccept(
    pending.phoneNumberId,
    pending.accessToken,
    pending.metaCallId,
    params.sdpAnswer
  );

  await MetaCallingService.accept(
    pending.phoneNumberId,
    pending.accessToken,
    pending.metaCallId,
    params.sdpAnswer
  );

  await prisma.call.update({
    where: { id: call.id },
    data: {
      status: 'CONNECTED',
      handler: 'AGENT',
      assignedAgentId: params.agentId,
      answeredAt: new Date(),
      startedAt: new Date(),
    },
  });

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
      await MetaCallingService.reject(
        pending.phoneNumberId,
        pending.accessToken,
        pending.metaCallId
      );
    } catch {
      // Meta may have already ended the call
    }
    await removePendingCall(call.metaCallId);
  }

  await prisma.call.update({
    where: { id: call.id },
    data: { status: 'REJECTED', handler: 'AGENT', endedAt: new Date(), assignedAgentId: params.agentId },
  });

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
