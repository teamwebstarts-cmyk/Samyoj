/**
 * Key-visual prompts for marketing posters (background only — copy is overlaid in UI).
 * See .cursor/skills/samyoj-marketing-poster/SKILL.md
 */

export type PosterFormat = 'square' | 'story';

export function buildMarketingBackgroundPrompt(opts: {
  occasion: string;
  subject: string;
  palette?: string;
  format?: PosterFormat;
}): string {
  const ratio =
    opts.format === 'story'
      ? 'Vertical 9:16 story marketing hero'
      : 'Square 1:1 marketing poster key visual';
  const palette = opts.palette || 'brand-appropriate festive colors';
  return [
    ratio,
    opts.occasion,
    opts.subject,
    `Color palette: ${palette}.`,
    'Composition: hero subject in lower two-thirds; large soft dark gradient across top third for headline overlay; clean center area for offer badge; uncluttered bottom strip for CTA button.',
    'Professional commercial photography, soft depth of field, low texture behind headline zone, high contrast for white typography.',
    'No text, no letters, no numbers, no logos, no watermarks, no signage.',
  ]
    .join(' ')
    .slice(0, 2000);
}

/** Wrap a brief or LLM imagePrompt into a safe marketing background spec. */
export function enhanceBriefAsMarketingBackground(brief: string, index = 0): string {
  const base = brief.trim().slice(0, 700);
  return buildMarketingBackgroundPrompt({
    occasion: base,
    subject: `Campaign visual variant ${index + 1}, single clear focal subject`,
    palette: 'cohesive campaign colors from the brief',
  });
}
