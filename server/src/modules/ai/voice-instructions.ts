/** Delimiter used when professional brains persist voice-specific instructions. */
const VOICE_BLOCK_START = '<!-- VOICE_INSTRUCTIONS -->';
const VOICE_BLOCK_END = '<!-- /VOICE_INSTRUCTIONS -->';

/**
 * Extract optional voice-only instructions embedded in AiBot.instructions.
 */
export function extractVoiceInstructions(instructions: string): string | null {
  const start = instructions.indexOf(VOICE_BLOCK_START);
  if (start < 0) return null;
  const from = start + VOICE_BLOCK_START.length;
  const end = instructions.indexOf(VOICE_BLOCK_END, from);
  if (end < 0) return null;
  const block = instructions.slice(from, end).trim();
  return block || null;
}

/** Strip the voice block so Personality UI can show chat instructions cleanly. */
export function stripVoiceInstructions(instructions: string): string {
  const start = instructions.indexOf(VOICE_BLOCK_START);
  if (start < 0) return instructions;
  const end = instructions.indexOf(VOICE_BLOCK_END, start);
  if (end < 0) return instructions;
  return `${instructions.slice(0, start)}${instructions.slice(end + VOICE_BLOCK_END.length)}`
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function embedVoiceInstructions(chatInstructions: string, voiceInstructions: string): string {
  const base = stripVoiceInstructions(chatInstructions).trim();
  const voice = voiceInstructions.trim();
  if (!voice) return base;
  return `${base}\n\n${VOICE_BLOCK_START}\n${voice}\n${VOICE_BLOCK_END}`;
}

/** Safety lines always appended for live calls when a VOICE block is used (non-negotiable). */
export const VOICE_SAFETY_RULES = [
  'Reply in 1 short sentence, 5-15 words. Never repeat the same sentence twice.',
  "Match the customer's language. No markdown. No emoji. Never output tool_call, XML, or code.",
  'You are ON this live call — never say you missed the call or invent a missed-call apology.',
  'Do not refuse with outside business hours on this live call — help briefly or offer WhatsApp follow-up.',
  'Before request_human: say the team will follow up on WhatsApp — never say please hold or promise a live transfer.',
].join(' ');
