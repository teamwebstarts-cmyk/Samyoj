import type { AiBot } from '@prisma/client';
import { DEFAULT_INSTRUCTIONS, hardcodedBotLlmDefaults } from '../ai/bot.service';

export type AiBotTestTurn = { role: 'user' | 'assistant'; content: string };

/** Chat Try-it uses the chat model; calling Try-it must use the voice brain. */
export function resolveAiBotTestChannel(
  botChannel: string | null | undefined
): 'text' | 'voice' {
  return botChannel === 'CALL' ? 'voice' : 'text';
}

export function sanitizeAiBotTestHistory(history: unknown, maxTurns = 12): AiBotTestTurn[] {
  if (!Array.isArray(history)) return [];
  const out: AiBotTestTurn[] = [];
  for (const row of history) {
    if (!row || typeof row !== 'object') continue;
    const role = (row as { role?: string }).role;
    const content = String((row as { content?: unknown }).content || '').trim();
    if ((role !== 'user' && role !== 'assistant') || !content) continue;
    out.push({ role, content: content.slice(0, 2000) });
    if (out.length >= maxTurns) break;
  }
  return out;
}

export function publicKnowledgeHasEmbedding(embedding: unknown): boolean {
  return Array.isArray(embedding) && embedding.length > 0;
}

/** In-memory bot for Try-it before the row exists. */
export function buildPreviewAiBot(
  organizationId: string,
  channel: 'CHAT' | 'CALL',
  opts: {
    name: string;
    instructions?: string;
    offerHandoff?: boolean;
    businessHoursOnly?: boolean;
  }
): AiBot {
  const llm = hardcodedBotLlmDefaults();
  return {
    id: 'preview',
    organizationId,
    name: opts.name.trim(),
    channel,
    enabled: true,
    isDefault: false,
    isSystem: false,
    instructions: opts.instructions?.trim() || DEFAULT_INSTRUCTIONS,
    handoffMessage: 'Let me connect you with our team. Someone will reply shortly.',
    triggerKeywords: [],
    handoffKeywords: [],
    offerHandoff: opts.offerHandoff ?? true,
    businessHoursOnly: opts.businessHoursOnly ?? false,
    temperature: llm.temperature,
    maxTokens: llm.maxTokens,
    rateLimitPerMin: llm.rateLimitPerMin,
    voiceGreeting: null,
    voiceSpeaker: null,
    voiceLanguage: null,
    businessWebsite: null,
    businessNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
