import {
  classifyProviderBoundaryOutcome,
  classifyProviderError,
} from '../campaigns/safety';

const TERMINAL_OUTBOUND = new Set(['SENT', 'DELIVERED', 'READ', 'FAILED', 'AMBIGUOUS']);

/** Worker/retry must not call Meta again after a completed or in-flight send. */
export function shouldSkipOutboundProviderRetry(row: {
  status: string;
  providerCallStartedAt?: Date | null;
}): boolean {
  if (TERMINAL_OUTBOUND.has(row.status)) return true;
  return Boolean(row.providerCallStartedAt);
}

/** After the provider HTTP call starts, only an explicit Meta rejection is FAILED. */
export function outboundStatusAfterProviderCallError(error: unknown): 'FAILED' | 'AMBIGUOUS' {
  return classifyProviderBoundaryOutcome(classifyProviderError(error).classification);
}
