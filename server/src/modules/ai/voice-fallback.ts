/** WhatsApp chat only — not spoken on a live call. */
export const FALLBACK_CHAT_MESSAGE =
  "Sorry, I couldn't help with that. Our team will assist you shortly.";

/** WhatsApp when the model is busy/limited — not a team handoff. */
export const CHAT_RETRY_BUSY =
  "I'm having a short delay. Please send that again in a moment.";

/** Live call: stay on the line instead of a dead-end team script. */
export const VOICE_KEEP_ON_LINE =
  'Haan, main yahin hoon. Bataiye aapko kis cheez mein madad chahiye?';

export const OPERATOR_VISIBLE_AI_SKIPS = [
  'rate_limited',
  'token_quota',
  'provider_rate_limit',
  'provider_overloaded',
  'provider_timeout',
  'provider_unavailable',
  'provider_error',
] as const;

export type OperatorVisibleAiSkip = (typeof OPERATOR_VISIBLE_AI_SKIPS)[number];

export function isOperatorVisibleAiSkip(reason?: string | null): reason is OperatorVisibleAiSkip {
  return Boolean(reason && (OPERATOR_VISIBLE_AI_SKIPS as readonly string[]).includes(reason));
}

export function operatorMessageForSkip(reason?: string | null): string {
  switch (reason) {
    case 'rate_limited':
      return 'AI is rate-limited in this workspace. Wait a few seconds, then try again.';
    case 'token_quota':
      return 'Monthly AI token limit reached for this workspace. Replies will resume next month or after the limit is raised.';
    case 'provider_rate_limit':
      return 'The AI provider hit a rate limit. Try again in a moment.';
    case 'provider_overloaded':
      return 'The AI provider is temporarily overloaded. The customer was not dropped — ask them to repeat if needed.';
    case 'provider_timeout':
      return 'The AI provider timed out. Ask the customer to repeat, or try again.';
    case 'provider_unavailable':
      return 'AI is not available right now. Check the connection and try again.';
    default:
      return 'AI could not reply just now. Try again — do not wait on a frozen typing state.';
  }
}

export function classifyAiBrainError(err: unknown): OperatorVisibleAiSkip {
  const status =
    err && typeof err === 'object' && 'statusCode' in err
      ? Number((err as { statusCode?: unknown }).statusCode)
      : 0;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (status === 429 && /monthly|token limit/i.test(msg)) return 'token_quota';
  if (status === 429 || /rate limit/i.test(msg)) return 'provider_rate_limit';
  if (status === 504 || /timed out|timeout/i.test(lower)) return 'provider_timeout';
  if (/model_overloaded|temporarily unavailable|503 service/i.test(lower)) {
    return 'provider_overloaded';
  }
  if (status === 401 || status === 403 || /authentication failed|api_key/i.test(lower)) {
    return 'provider_unavailable';
  }
  if (status === 503) return 'provider_unavailable';
  return 'provider_error';
}

export function spokenAfterBrainFailure(
  channel?: 'text' | 'voice',
  skipReason: string = 'provider_error'
): {
  reply: string;
  handoff: boolean;
  skipped: boolean;
  skipReason: string;
} {
  if (channel === 'voice') {
    return { reply: VOICE_KEEP_ON_LINE, handoff: false, skipped: true, skipReason };
  }
  return { reply: CHAT_RETRY_BUSY, handoff: false, skipped: true, skipReason };
}

export function aiBrainRateLimitKey(
  organizationId: string,
  botId: string,
  opts: { voice?: boolean; testMode?: boolean }
): string {
  if (opts.testMode && botId === 'preview') return `ai-bot:${organizationId}:preview`;
  if (opts.voice) return `ai-bot-voice:${organizationId}:${botId}`;
  return `ai-bot:${organizationId}:${botId}`;
}
