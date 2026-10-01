import type { StudioPack, StudioSlide, StudioSlideStyle } from '../../services/api';

export type { StudioPack, StudioSlide, StudioSlideStyle };

export type StudioPhase = 'brief' | 'generating' | 'review';

export const STUDIO_BRIEF_MAX = 2000;
export const STUDIO_SLIDES_MIN = 2;
export const STUDIO_SLIDES_MAX = 10;

/** Slide poster themes — pure CSS, matching the approved design's style chips. */
export const SLIDE_THEMES: Array<{ value: StudioSlideStyle; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'festival', label: 'Festival' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'modern', label: 'Modern' },
  { value: 'premium', label: 'Premium' },
];

export const STUDIO_EXAMPLES: Array<{
  id: string;
  label: string;
  brief: string;
  slides: number;
  /** Example card art — small CSS gradient scene, mirrors the design's visual cards. */
  art: { bg: string; glyph: string; accent: string };
}> = [
  {
    id: 'festival-offer',
    label: 'Festival offer',
    brief:
      'Diwali 20% off this weekend at our Jaipur store. Create a 5-slide Instagram carousel, a WhatsApp template and an email with a special offer. Use festive theme, warm colors and product images.',
    slides: 5,
    art: { bg: 'linear-gradient(135deg, #7c2d12 0%, #b45309 55%, #f59e0b 100%)', glyph: '🪔', accent: '#fbbf24' },
  },
  {
    id: 'product-launch',
    label: 'Product launch',
    brief:
      'Launching our new aloe vera skincare range this Friday. Tell the natural ingredients story across the carousel and draft a WhatsApp template plus email announcement.',
    slides: 5,
    art: { bg: 'linear-gradient(135deg, #064e3b 0%, #059669 60%, #6ee7b7 100%)', glyph: '🌿', accent: '#a7f3d0' },
  },
  {
    id: 'announcement',
    label: 'Announcement',
    brief:
      'We are opening a second branch in Udaipur next month. Announce it warmly and invite customers to the opening week discounts.',
    slides: 4,
    art: { bg: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 60%, #93c5fd 100%)', glyph: '📣', accent: '#bfdbfe' },
  },
  {
    id: 'tips-education',
    label: 'Tips & education',
    brief:
      '5 skincare tips for winter using our products. Educational carousel, friendly tone, ending with a soft product mention.',
    slides: 6,
    art: { bg: 'linear-gradient(135deg, #701a75 0%, #c026d3 55%, #f0abfc 100%)', glyph: '💡', accent: '#f5d0fe' },
  },
];

/** Background/ink for a slide poster, by theme. Used by the visual slide cards. */
export function slideThemeCss(style: StudioSlideStyle | undefined): { bg: string; ink: string; chip: string } {
  switch (style) {
    case 'festival':
      return {
        bg: 'radial-gradient(ellipse 90% 70% at 80% 10%, rgba(251,191,36,0.35), transparent 60%), linear-gradient(150deg, #4c1d95 0%, #7c2d12 60%, #b45309 100%)',
        ink: '#fff7ed',
        chip: 'rgba(251,191,36,0.9)',
      };
    case 'minimal':
      return {
        bg: 'linear-gradient(160deg, #fafaf9 0%, #f1f5f9 100%)',
        ink: '#1c1917',
        chip: '#a8a29e',
      };
    case 'modern':
      return {
        bg: 'radial-gradient(ellipse 80% 80% at 20% 0%, rgba(139,92,246,0.45), transparent 60%), linear-gradient(150deg, #1e1b4b 0%, #312e81 55%, #6d28d9 100%)',
        ink: '#f5f3ff',
        chip: 'rgba(196,181,253,0.9)',
      };
    case 'premium':
      return {
        bg: 'radial-gradient(ellipse 90% 70% at 85% 15%, rgba(212,175,55,0.35), transparent 55%), linear-gradient(155deg, #0c0a09 0%, #292524 55%, #57534e 100%)',
        ink: '#fafaf9',
        chip: '#d4af37',
      };
    default:
      return {
        bg: 'linear-gradient(155deg, var(--ais-violet-soft) 0%, var(--color-surface) 70%)',
        ink: 'var(--ais-ink)',
        chip: 'var(--ais-violet)',
      };
  }
}

/** Numbered {{1}} variables the wizard can map to sample values. */
export function countWaVariables(body: string): number {
  const matches = body.match(/\{\{\d+\}\}/g);
  if (!matches) return 0;
  return Math.max(0, ...matches.map((m) => parseInt(m.slice(2, -2), 10) || 0));
}

/** Filename from a pack brief — used for hand-off names. */
export function packName(pack: StudioPack): string {
  const first = pack.brief.trim().split(/[.\n]/)[0] || 'Content pack';
  return first.length > 48 ? `${first.slice(0, 48)}…` : first;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
