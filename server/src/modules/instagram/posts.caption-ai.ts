import { CAPTION_MAX } from './posts.limits';

export type CaptionAiMode = 'polish' | 'generate';

const POLISH_SYSTEM = `You polish Instagram captions. Return only the polished caption. No title, no quotes, no markdown, no preamble.

Rules:
- Keep the same language as the original (English, Hindi, Hinglish, or any other). Do not translate.
- Keep the same caption type and vibe: a sale stays a sale, a story stays a story, a dry one-liner stays a one-liner. Do not turn it into a different post.
- Do not invent a new caption. Improve what is already there: grammar, rhythm, line breaks, clarity.
- Keep facts, names, prices, dates, links, @mentions, and existing hashtags. Do not add new claims or a new hashtag dump.
- Stay under ${CAPTION_MAX} characters.`;

const GENERATE_SYSTEM = `You write Instagram captions. Return only the caption text. No title, no quotes, no markdown, no preamble.

Rules:
- Match the language of the user's prompt (English, Hindi, Hinglish, or any other).
- Write the kind of caption that prompt asks for (drop, offer, BTS, personal, etc.). Sound like a real Instagram post, not an ad agency slogan.
- Use short lines or 1–4 tight paragraphs. A few relevant hashtags are fine if they fit; do not spam.
- Do not invent prices, phone numbers, dates, or promises that were not in the prompt.
- Stay under ${CAPTION_MAX} characters.`;

export function captionAiMessages(
  mode: CaptionAiMode,
  text: string,
): { system: string; user: string } {
  const trimmed = text.trim();
  if (mode === 'polish') {
    return {
      system: POLISH_SYSTEM,
      user: `Polish this Instagram caption. Keep its language and meaning:\n\n${trimmed}`,
    };
  }
  return {
    system: GENERATE_SYSTEM,
    user: `Write an Instagram caption from this:\n\n${trimmed}`,
  };
}

export function stripCaptionOutput(raw: string, max = CAPTION_MAX): string {
  let text = raw.trim().replace(/^```(?:\w+)?\s*/i, '').replace(/\s*```$/i, '').trim();
  text = text.replace(/^(?:instagram\s+)?caption\s*[:\-–]\s*/i, '').trim();
  text = text.replace(/^["'“”«»]+/, '').replace(/["'“”«»]+$/, '').trim();
  if (text.length > max) text = text.slice(0, max).trimEnd();
  return text;
}
