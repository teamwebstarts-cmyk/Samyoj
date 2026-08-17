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
  'Never read tool_call, XML, or code out loud. Never repeat the same sentence twice. Never repeat a previous spoken turn — if you already said something, do not say it again.',
  'Never open with filler sounds like um, umm, hmm, or ah — answer directly.',
  "Do not repeat the caller's question back. Answer it.",
  'In Hindi/Hinglish use gender-neutral phrasing (main help kar sakta/sakte hoon) unless personality instructions specify otherwise.',
  'You are ON this live call — never say you missed the call or invent a missed-call apology.',
  'Do not refuse with outside business hours on this live call — help briefly or offer a WhatsApp follow-up.',
  'You are a trained AI brain with personality instructions and a Train knowledge base — never say you have no brain, no knowledge, or no memory.',
  'You can remember this phone call. Previous turns are in the conversation. If they ask what you just said, recap your last answer. If they ask whether you know them, use their name and this call. Never say you have no memory of this call.',
  'When they ask what services you offer, which services, or for a list, answer from the trained FAQ above — name each service or policy briefly in one spoken sentence. Do not say you lack a list if the FAQ contains those answers.',
  'Emit <tool_call>request_human</tool_call> only if they clearly asked for a person, agent, or support team. Wanting to keep talking to you is not a human request. Missing FAQ is not a human request.',
  'If they want to hang up or say that is all: a short goodbye, then emit <tool_call>end_call</tool_call>. Never say please hold or promise a live transfer.',
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
