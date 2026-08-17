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

/** Mute mic→STT while TTS plays and for this tail so speakerphone echo is not transcribed. */
export const STT_ECHO_TAIL_MS = 800;

/** Reject transcripts that look like the bot's own line for this long after TTS ends. */
export const TTS_ECHO_REJECT_MS = STT_ECHO_TAIL_MS + 1200;

/** Ignore STT fragments shorter than this unless they are a clear yes/no style answer. */
export const MIN_CALL_UTTERANCE_CHARS = 6;

/** Do not barge-in on VAD during the first stretch of TTS (early speakerphone echo). */
export const TTS_BARGE_IN_MIN_MS = 700;

/** Inbound PCM RMS must stay above this for barge-in while TTS is playing. */
export const BARGE_IN_RMS_THRESHOLD = 1800;

/** Consecutive loud frames required before stopping TTS (~60ms @ 10ms frames). */
export const BARGE_IN_FRAMES_REQUIRED = 6;

export function shouldMuteCallStt(
  speaking: boolean,
  speakingEndedAt: number,
  now: number,
  echoTailMs = STT_ECHO_TAIL_MS
): boolean {
  // Keep STT live during TTS so the caller can barge in; only mute the echo tail after playback.
  if (speaking) return false;
  if (speakingEndedAt <= 0) return false;
  return now - speakingEndedAt < echoTailMs;
}

/** Queue a newer caller turn while the bot is still replying (LLM or TTS). */
export function shouldQueueVoiceInterrupt(processing: boolean, _speaking: boolean): boolean {
  return processing;
}

export function shouldAllowBargeInDuringTts(
  speaking: boolean,
  speakingStartedAt: number,
  now: number,
  minMs = TTS_BARGE_IN_MIN_MS
): boolean {
  if (!speaking || speakingStartedAt <= 0) return false;
  return now - speakingStartedAt >= minMs;
}

export function shouldTriggerBargeInFromRms(
  speaking: boolean,
  speakingStartedAt: number,
  rms: number,
  loudFrameStreak: number,
  now: number,
  opts?: {
    minMs?: number;
    rmsThreshold?: number;
    framesRequired?: number;
  }
): boolean {
  if (!shouldAllowBargeInDuringTts(speaking, speakingStartedAt, now, opts?.minMs)) return false;
  const threshold = opts?.rmsThreshold ?? BARGE_IN_RMS_THRESHOLD;
  const framesRequired = opts?.framesRequired ?? BARGE_IN_FRAMES_REQUIRED;
  return rms >= threshold && loudFrameStreak >= framesRequired;
}

export function isShortValidUtterance(text: string): boolean {
  const t = normalizeVoiceText(text);
  return /^(no|nahi|na|yes|haan|han|cancel|stop)$/.test(t);
}

export function shouldProcessCallerUtterance(
  text: string,
  minChars = MIN_CALL_UTTERANCE_CHARS
): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (isShortValidUtterance(trimmed)) return true;
  return trimmed.length >= minChars;
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
