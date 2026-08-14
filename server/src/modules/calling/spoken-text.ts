/** Make LLM text sound natural on Sarvam Bulbul (phone, not a document). */

/** Sarvam REST TTS truncates around 500 chars — stay under that per request. */
export const TTS_MAX_CHARS = 450;

export function prepareSpokenText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[*_`#]+/g, '')
    .replace(/&/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** One opening utterance so consent + greeting are not two robot dumps. */
export function joinSpokenTurns(...parts: Array<string | undefined | null>): string {
  return parts
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .map((part) => (/[.!?।॥]$/.test(part) ? part : `${part}.`))
    .join(' ');
}

export function normalizeVoiceText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split only when a single TTS request would truncate — keep one clip when possible. */
export function splitForTts(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= TTS_MAX_CHARS) return [trimmed];

  const raw = trimmed.split(/(?<=[.!?;।॥])\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const part of raw) {
    if (current && current.length + part.length + 1 > TTS_MAX_CHARS) {
      chunks.push(current.trimEnd());
      current = part;
    } else {
      current = current ? `${current} ${part}` : part;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [trimmed.slice(0, TTS_MAX_CHARS)];
}

export function isLikelyTtsEcho(heard: string, spoken: string): boolean {
  const a = normalizeVoiceText(heard);
  const b = normalizeVoiceText(spoken);
  if (!a || !b || a.length < 6) return false;
  if (b.includes(a)) return true;
  if (a.length >= 12 && b.length >= 12 && a.includes(b.slice(0, Math.min(40, b.length)))) {
    return true;
  }
  const aTok = a.split(' ').filter((w) => w.length > 2);
  const bTok = new Set(b.split(' ').filter((w) => w.length > 2));
  if (aTok.length === 0 || bTok.size === 0) return false;
  let hit = 0;
  for (const token of aTok) {
    if (bTok.has(token)) hit += 1;
  }
  return hit / aTok.length >= 0.7;
}
