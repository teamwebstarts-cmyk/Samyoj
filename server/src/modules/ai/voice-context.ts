export type LiveVoiceTurn = { role: 'user' | 'assistant'; content: string };

/** Prior turns from the live call — not WhatsApp chat rows, which omit spoken audio. */
export function liveVoiceTurnsFromTranscript(
  transcript: Array<{ role: string; text?: string | null }>,
  inboundMessage: string
): LiveVoiceTurn[] {
  const turns: LiveVoiceTurn[] = [];
  for (const entry of transcript) {
    // Opening greeting is stored as `system` — still spoken words the model must remember.
    const role: LiveVoiceTurn['role'] | null =
      entry.role === 'user' ? 'user' : entry.role === 'assistant' || entry.role === 'system' ? 'assistant' : null;
    if (!role) continue;
    const content = String(entry.text || '').trim();
    if (!content) continue;
    turns.push({ role, content });
  }
  const inbound = String(inboundMessage || '').trim();
  const last = turns[turns.length - 1];
  if (inbound && last?.role === 'user' && last.content === inbound) {
    turns.pop();
  }
  return turns.slice(-12);
}
