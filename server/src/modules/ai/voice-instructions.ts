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

/**
 * Spoken style for Sarvam-105B-conversations + Bulbul on a live WhatsApp call.
 * Keep it like a real person on the phone — not a clipped IVR, not a chat essay.
 */
export const VOICE_SAFETY_RULES = [
  'You are on a live phone call. Talk like a helpful person on the phone, not a chatbot or IVR.',
  'Reply in one or two spoken sentences as one continuous thought. Do not pause between fragments. Do not list brands or options unless they asked.',
  "Match the caller's language, including Hinglish if they mix Hindi and English.",
  'Keep punctuation so speech has a natural rhythm. No markdown, emoji, URLs, or bullet points.',
  'Never read tool_call, XML, or code out loud. Never repeat the same sentence twice.',
  "Do not repeat the caller's question back. Answer it.",
  'You are ON this live call — never say you missed the call or invent a missed-call apology.',
  'Do not refuse with outside business hours on this live call — help briefly or offer a WhatsApp follow-up.',
  'If they want a person or support team: say the team will message them on WhatsApp, then emit <tool_call>request_human</tool_call>. Stop selling. Never say please hold or promise a live transfer.',
  'If they want to hang up or say that is all: a short goodbye, then emit <tool_call>end_call</tool_call>.',
].join(' ');

/** Old templates clipped speech to 15 words. Strip that so live calls can sound human. */
export function relaxClippedVoiceLines(instructions: string): string {
  return instructions
    .replace(/Voice replies must be under \d+ words[^.]*\./gi, '')
    .replace(/Keep replies under \d+ words[^.]*\./gi, '')
    .replace(/One short sentence is ideal[^.]*\./gi, '')
    .replace(/Speak slowly and clearly[^.]*\./gi, '')
    .replace(/Enunciate every word[^.]*\./gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
