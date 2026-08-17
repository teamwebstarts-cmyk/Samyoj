import { FLOW_LOCK_BUSY, type HandleInboundFlowResult } from '../flows/inbound-wait';
import { isBotPaused } from '../flows/live';

export const INBOUND_LOCK_REQUEUE_MAX = 8;

export type InboundFunnelDecision =
  | { type: 'skip'; reason: 'paused' | 'lock_giveup' }
  | { type: 'requeue' }
  | { type: 'flow_done' }
  | { type: 'continue_static' };

/** Decision table for inbound: pause → flow → lock requeue → static/AI. */
export function decideInboundFunnel(input: {
  botActive?: boolean | null;
  optedIn?: boolean | null;
  flowHandled?: HandleInboundFlowResult;
  lockRetry?: number;
  lockRetryMax?: number;
}): InboundFunnelDecision {
  if (isBotPaused(input)) return { type: 'skip', reason: 'paused' };
  if (input.flowHandled === undefined) return { type: 'continue_static' };
  if (input.flowHandled === FLOW_LOCK_BUSY) {
    const attempt = input.lockRetry ?? 0;
    const max = input.lockRetryMax ?? INBOUND_LOCK_REQUEUE_MAX;
    if (attempt >= max) return { type: 'skip', reason: 'lock_giveup' };
    return { type: 'requeue' };
  }
  if (input.flowHandled) return { type: 'flow_done' };
  return { type: 'continue_static' };
}
