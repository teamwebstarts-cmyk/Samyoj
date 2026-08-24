import { canonicalAiUsageAction } from '../../ai/ai-usage-actions';
import type { AiCreditPool } from './catalog';

const CHAT_ACTIONS = new Set([
  'chat_bot',
  'chat',
  'embedding',
  'generate_personality',
  'generate_training',
  'call_summary',
  'support_help',
  'content_studio',
]);

const CALLING_ACTIONS = new Set(['calling_llm', 'stt', 'tts']);

export function poolForAiAction(action: string): AiCreditPool | null {
  const key = canonicalAiUsageAction(action);
  if (CHAT_ACTIONS.has(key)) return 'chat';
  if (CALLING_ACTIONS.has(key)) return 'calling';
  return null;
}

/** Calling LLM tokens still roll up to per-call minute billing — skip per-log deduct. */
export function shouldDeductOnUsageLog(action: string): boolean {
  const key = canonicalAiUsageAction(action);
  if (CALLING_ACTIONS.has(key)) return false;
  return CHAT_ACTIONS.has(key);
}
