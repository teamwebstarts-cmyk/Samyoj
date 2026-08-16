import type { TokenUsage } from './types';

/** Named AI surfaces for Reports (SAMYOJ-56). Legacy `chat` maps to chat_bot. */
export const AI_USAGE_ACTIONS = [
  'chat_bot',
  'calling_llm',
  'stt',
  'tts',
  'embedding',
  'content_studio',
  'generate_personality',
  'generate_training',
  'call_summary',
] as const;

export type AiUsageAction = (typeof AI_USAGE_ACTIONS)[number];

export type RecordableAiAction = AiUsageAction | 'chat';

export const AI_USAGE_LABELS: Record<AiUsageAction, string> = {
  chat_bot: 'WhatsApp chat',
  calling_llm: 'Call replies',
  stt: 'Call listening',
  tts: 'Call speaking',
  embedding: 'Training (Ready)',
  content_studio: 'Content Studio',
  generate_personality: 'Write personality',
  generate_training: 'Write training answers',
  call_summary: 'Call summary',
};

export function canonicalAiUsageAction(action: string): AiUsageAction | string {
  if (action === 'chat') return 'chat_bot';
  return action;
}

/** Rough unit estimate when a provider does not return token counts (STT/TTS/stream). */
export function estimateUsageUnits(inputText: string, outputText = ''): TokenUsage {
  const promptTokens = Math.max(0, Math.ceil(inputText.length / 4));
  const completionTokens = Math.max(0, Math.ceil(outputText.length / 4));
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

export function charUsage(inputChars: number, outputChars = 0): TokenUsage {
  return {
    promptTokens: Math.max(0, inputChars),
    completionTokens: Math.max(0, outputChars),
    totalTokens: Math.max(0, inputChars) + Math.max(0, outputChars),
  };
}
