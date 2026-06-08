const SCRIPT_PATTERNS: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /[\u0900-\u097F]/, code: 'hi' },
  { pattern: /[\u0980-\u09FF]/, code: 'bn' },
  { pattern: /[\u0A00-\u0A7F]/, code: 'pa' },
  { pattern: /[\u0A80-\u0AFF]/, code: 'gu' },
  { pattern: /[\u0B00-\u0B7F]/, code: 'or' },
  { pattern: /[\u0B80-\u0BFF]/, code: 'ta' },
  { pattern: /[\u0C00-\u0C7F]/, code: 'te' },
  { pattern: /[\u0C80-\u0CFF]/, code: 'kn' },
  { pattern: /[\u0D00-\u0D7F]/, code: 'ml' },
  { pattern: /[\u0600-\u06FF]/, code: 'ar' },
  { pattern: /[\u4e00-\u9fff]/, code: 'zh' },
  { pattern: /[\u3040-\u30ff]/, code: 'ja' },
  { pattern: /[\uac00-\ud7af]/, code: 'ko' },
  { pattern: /[\u0400-\u04FF]/, code: 'ru' },
];

export function detectMessageLanguage(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return 'en';

  for (const { pattern, code } of SCRIPT_PATTERNS) {
    if (pattern.test(trimmed)) return code;
  }

  return 'en';
}
