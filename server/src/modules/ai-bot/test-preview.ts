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
