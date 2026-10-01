import { brandSystemPrompt } from '../content-studio/composer/tools';
import { MARKETING_COPY_SYSTEM_PROMPT } from './prompts/marketing-copy-system';

type StudioBrand = Parameters<typeof brandSystemPrompt>[0];

export function buildStudioSystemPrompt(
  brief: string,
  language: string,
  outputs: string[],
  brandKit: StudioBrand,
  photoNames: string[] = [],
): string {
  const asked = outputs.join(', ');
  return [
    MARKETING_COPY_SYSTEM_PROMPT,
    brandSystemPrompt(brandKit, language),
    `Language: ${language}.`,
    `User brief: ${brief}`,
    photoNames.length ? `Reference photo file names (subject hints only): ${photoNames.join(', ')}.` : '',
    `Write only these modes: ${asked}.`,
    'Return ONE JSON object and nothing else. No markdown fences. No explanation.',
    'Keys: name, imagePrompt, ctx {occasion, pct, place}.',
    'imagePrompt: short visual direction for the art director (subject, mood, palette, platform). Do not repeat the full caption.',
    outputs.some((id) => id === 'ig_carousel' || id === 'ig_image')
      ? 'instagram: {caption, hashtags}. Caption is the full Instagram caption from the INSTAGRAM rules, with line breaks as \\n.'
      : '',
    outputs.includes('ig_carousel')
      ? 'carouselSlides: 3 to 5 items of {headline, sub, offer?, cta?}. Headline ≤ 8 words. These lines are also rendered on the poster, so they must be exact and short.'
      : '',
    outputs.includes('ig_image') ? 'imageCopy: {headline, sub}.' : '',
    outputs.includes('whatsapp')
      ? 'whatsapp: {name, body, footer, buttonLabel, buttonUrl, examples}. name is snake_case. body uses {{1}} for the customer name. examples is {"1":"Riya"}.'
      : '',
    outputs.includes('email')
      ? 'email: {subject, body}. Body is plain text, starts with the preheader line, then Hi {{name}},.'
      : '',
  ].filter(Boolean).join('\n');
}

export function extractJsonObject(raw: string): Record<string, unknown> {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object');
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice) as Record<string, unknown>;
  } catch {
    const fixed = slice.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(fixed) as Record<string, unknown>;
  }
}
