/** Mirrors server skip reasons so Inbox/Calls/Try-it can explain AI failures. */
export function explainAiSkipReason(reason?: string | null): string {
  switch (reason) {
    case 'ai_not_configured':
      return 'AI is not set up on this server yet.';
    case 'chat_ai_disabled':
      return 'Chat AI is off in Settings → AI.';
    case 'calling_ai_disabled':
      return 'Calling AI is off for this workspace.';
    case 'no_matching_bot':
      return 'Could not load this bot. Add a name in About and try again.';
    case 'empty_message':
      return 'Type a customer message first.';
    case 'rate_limited':
      return 'Too many AI replies just now. Wait a few seconds.';
    case 'token_quota':
      return 'Monthly AI token limit reached for this workspace.';
    case 'credits_exhausted':
      return 'AI credits are used up for this workspace. Open Billing and buy a chat top-up, then try again.';
    case 'plan_ai_locked':
      return 'AI is not included on this plan. Upgrade to Growth or Pro in Billing, then try again.';
    case 'provider_rate_limit':
      return 'The AI provider hit a rate limit. Try again in a moment.';
    case 'provider_overloaded':
      return 'The AI provider is temporarily overloaded. Try again in a moment.';
    case 'provider_timeout':
      return 'The AI provider timed out. Try again.';
    case 'provider_unavailable':
      return 'AI is not available right now. Try again shortly.';
    case 'provider_error':
      return 'AI could not reply just now. Try again.';
    case 'outside_business_hours':
      return 'This bot is set to stay quiet outside business hours.';
    default:
      return reason || 'No reply yet.';
  }
}

export function httpStatusToAiSkipReason(status?: number, message?: string, code?: string): string | undefined {
  const lower = (message || '').toLowerCase();
  if (code === 'AI_CREDITS_EXHAUSTED' || /credits exhausted|minutes exhausted/i.test(message || '')) {
    return 'credits_exhausted';
  }
  if (code === 'PLAN_FEATURE_AI' || /available on growth and pro|not included on your plan/i.test(lower)) {
    return 'plan_ai_locked';
  }
  if (status === 429 && /monthly|token limit/i.test(message || '')) return 'token_quota';
  if (status === 429) return 'rate_limited';
  if (status === 504 || /timed out|timeout/i.test(lower)) return 'provider_timeout';
  if (status === 503 || /overloaded|temporarily unavailable/i.test(lower)) {
    return 'provider_overloaded';
  }
  return undefined;
}
