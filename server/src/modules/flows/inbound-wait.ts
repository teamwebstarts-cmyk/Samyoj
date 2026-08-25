import type { FlowState } from './types';

export const FLOW_LOCK_BUSY = 'lock_busy' as const;
export type HandleInboundFlowResult = boolean | typeof FLOW_LOCK_BUSY;

export function flowDelayJobId(conversationId: string): string {
  return `flow-delay-${conversationId}`;
}

export function inboundLockRetryJobId(conversationId: string, messageId: string): string {
  return `flow-retry-${conversationId}-${messageId}`;
}

export function hasWaFlowResponse(payload: { waFlowResponse?: Record<string, unknown> }): boolean {
  return Boolean(payload.waFlowResponse && Object.keys(payload.waFlowResponse).length > 0);
}

/**
 * Delay and Meta Form waits must not swallow unrelated inbound.
 * Form completion (nfm_reply) still continues the waiting form.
 */
export function shouldInterruptWait(
  waitingFor: FlowState['waitingFor'],
  payload: { waFlowResponse?: Record<string, unknown> },
  options?: { interruptOnInbound?: boolean }
): boolean {
  if (waitingFor === 'delay') return options?.interruptOnInbound !== false;
  if (waitingFor === 'wa_flow') return !hasWaFlowResponse(payload);
  return false;
}
