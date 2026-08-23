import type { BrandKit } from '@prisma/client';

export const COMPOSER_TOOL_ACTIONS = [
  'rewrite',
  'shorten',
  'expand',
  'translate',
  'on_brand',
  'ab_variants',
  'button_list',
] as const;

export type ComposerToolAction = (typeof COMPOSER_TOOL_ACTIONS)[number];

const LOCALE_TO_META: Record<string, string> = {
  en: 'en_US',
  'en-IN': 'en_IN',
  'en-US': 'en_US',
  'en_IN': 'en_IN',
  'en_US': 'en_US',
  hi: 'hi',
  'hi-IN': 'hi',
  ta: 'ta',
  'ta-IN': 'ta',
  te: 'te',
  'te-IN': 'te',
  bn: 'bn',
  'bn-IN': 'bn',
  mr: 'mr',
  'mr-IN': 'mr',
  gu: 'gu',
  'gu-IN': 'gu',
};

export function localeToMetaLanguage(locale: string): string {
  const key = locale.trim();
  if (!key) return 'en_US';
  if (LOCALE_TO_META[key]) return LOCALE_TO_META[key];
  if (key.includes('-')) return key.replace('-', '_');
  return key;
}

export function slugTemplateName(companyName: string, now = Date.now()): string {
  const slug =
    companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'studio';
  return `studio_${slug}_${now.toString(36)}`;
}

export function brandSystemPrompt(brandKit: BrandKit | null, locale: string): string {
  const toneHints = brandKit
    ? `Tone: formal ${brandKit.toneFormal}/100, brief ${brandKit.toneBrief}/100, friendly ${brandKit.toneFriendly}/100, playful ${brandKit.tonePlayful}/100.`
    : '';

  return [
    'You are a WhatsApp marketing copywriter.',
    brandKit ? `Brand: ${brandKit.companyName}. Audience: ${brandKit.audience || 'general'}.` : '',
    toneHints,
    brandKit?.valueProps?.length ? `Value props: ${brandKit.valueProps.join(', ')}.` : '',
    brandKit?.sampleLike?.length ? `Write like: ${brandKit.sampleLike.join('; ')}.` : '',
    brandKit?.sampleDislike?.length ? `Avoid style like: ${brandKit.sampleDislike.join('; ')}.` : '',
    brandKit?.bannedWords?.length ? `Never use: ${brandKit.bannedWords.join(', ')}.` : '',
    brandKit?.mandatoryPhrases?.length
      ? `If this is marketing copy, include one of: ${brandKit.mandatoryPhrases.join(' | ')}.`
      : '',
    `Output locale: ${locale}. Keep under 1024 characters unless the tool says otherwise.`,
  ]
    .filter(Boolean)
    .join(' ');
}

export function toolInstruction(action: ComposerToolAction, locale: string): string {
  switch (action) {
    case 'rewrite':
      return 'Rewrite the copy. Keep the same meaning and facts. Vary wording and rhythm. Return only the rewritten message.';
    case 'shorten':
      return 'Shorten the copy to fit WhatsApp template body limits (max 1024 characters, prefer under 400). Keep the CTA and any opt-out line. Return only the shortened message.';
    case 'expand':
      return 'Expand the copy with one extra concrete detail and a clear next step. Stay under 1024 characters. Return only the expanded message.';
    case 'translate':
      return `Translate the copy into ${locale}. Keep names, prices, and {{n}} variables unchanged. Use natural phrasing for that locale, not word-for-word English. Return only the translation.`;
    case 'on_brand':
      return 'Rewrite so it matches the brand kit tone, value props, and banned-word rules. Keep the offer and CTA. Return only the on-brand message.';
    case 'ab_variants':
      return `Write exactly 5 A/B variants of this WhatsApp message in ${locale}. Return a JSON array of 5 strings and nothing else. Each variant must stay under 1024 characters.`;
    case 'button_list':
      return 'Turn this paragraph into a WhatsApp list message. Return plain text with: a body line, then sections as "Section: title" and rows as "- row title — short description". Max 10 rows, section titles ≤ 24 chars, row titles ≤ 24 chars.';
  }
}

export function parseAbVariants(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const tryJson = (value: string): string[] | null => {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean).slice(0, 5);
      }
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { variants?: unknown }).variants)) {
        return ((parsed as { variants: unknown[] }).variants)
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 5);
      }
    } catch {
      return null;
    }
    return null;
  };

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const fromFence = fenced ? tryJson(fenced[1].trim()) : null;
  if (fromFence?.length) return fromFence;

  const fromRaw = tryJson(trimmed);
  if (fromRaw?.length) return fromRaw;

  const numbered = trimmed
    .split(/\n(?=\s*\d+[\).:-]\s)/)
    .map((line) => line.replace(/^\s*\d+[\).:-]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
  if (numbered.length >= 2) return numbered;

  return [trimmed];
}

export function bodyVariableExamples(body: string): string[] | undefined {
  const matches = body.match(/\{\{\d+\}\}/g) || [];
  if (matches.length === 0) return undefined;
  const unique = [...new Set(matches)];
  return unique.map((_, index) => `sample${index + 1}`);
}
