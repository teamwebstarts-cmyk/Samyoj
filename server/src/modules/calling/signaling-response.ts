import { isTerminalCallStatus } from './call.processor';

export type CallSignalingPayload = {
  callId: string;
  sdpOffer: string | null;
  sdpAnswer: string | null;
  metaCallId: string | null;
  ended: boolean;
};

/** Shape for GET /calling/:id/signaling — never 404 just because Redis pending expired. */
export function buildCallSignalingPayload(input: {
  callId: string;
  status: string;
  pending: { sdpOffer: string; sdpAnswer?: string; metaCallId: string } | null;
}): CallSignalingPayload {
  if (input.pending) {
    return {
      callId: input.callId,
      sdpOffer: input.pending.sdpOffer,
      sdpAnswer: input.pending.sdpAnswer || null,
      metaCallId: input.pending.metaCallId,
      ended: false,
    };
  }
  return {
    callId: input.callId,
    sdpOffer: null,
    sdpAnswer: null,
    metaCallId: null,
    ended: isTerminalCallStatus(input.status),
  };
}
