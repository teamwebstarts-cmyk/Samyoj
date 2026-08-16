export type TextSize = 'small' | 'default' | 'large';

export type FontFamilyId =
  | 'jakarta'
  | 'inter'
  | 'geist'
  | 'ibm-plex'
  | 'source-sans'
  | 'roboto'
  | 'public-sans'
  | 'figtree'
  | 'noto'
  | 'atkinson'
  | 'system';

export const TEXT_SIZE_STORAGE_KEY = 'samyoj:text-size:v1';
export const FONT_FAMILY_STORAGE_KEY = 'samyoj:font-family:v1';

/** Root `html` font-size. Rem-based type follows this; do not set per-page fonts. */
export const TEXT_SIZE_PX: Record<TextSize, string> = {
  small: '14px',
  default: '16px',
  large: '18px',
};

export const DEFAULT_TEXT_SIZE: TextSize = 'default';
export const DEFAULT_FONT_FAMILY: FontFamilyId = 'jakarta';

const GOOGLE_WEIGHTS = 'ital,wght@0,400;0,500;0,600;0,700;0,800;1,400';
const GOOGLE_WEIGHTS_NO_800 = 'ital,wght@0,400;0,500;0,600;0,700;1,400';
const GOOGLE_WEIGHTS_ROBOTO = 'ital,wght@0,400;0,500;0,700;1,400';
const GOOGLE_WEIGHTS_ATKINSON = 'ital,wght@0,400;0,700;1,400;1,700';

function googleCss(family: string, weights = GOOGLE_WEIGHTS): string {
  return `https://fonts.googleapis.com/css2?family=${family}:${weights}&display=swap`;
}

export type FontFamilyBadge = 'default' | 'recommended';

export const FONT_FAMILIES: Array<{
  id: FontFamilyId;
  label: string;
  hint: string;
  stack: string;
  href: string | null;
  badge?: FontFamilyBadge;
}> = [
  {
    id: 'jakarta',
    label: 'Plus Jakarta Sans',
    hint: 'Samyoj default — warm, professional, already the product look',
    stack: '"Plus Jakarta Sans", system-ui, sans-serif',
    href: null,
    badge: 'default',
  },
  {
    id: 'inter',
    label: 'Inter',
    hint: 'Best swap for dense CRM work — same family as Linear, Notion, GitHub',
    stack: 'Inter, system-ui, sans-serif',
    href: googleCss('Inter'),
    badge: 'recommended',
  },
  {
    id: 'geist',
    label: 'Geist',
    hint: 'Modern SaaS dashboards',
    stack: 'Geist, system-ui, sans-serif',
    href: googleCss('Geist'),
  },
  {
    id: 'ibm-plex',
    label: 'IBM Plex Sans',
    hint: 'Enterprise / operations tools',
    stack: '"IBM Plex Sans", system-ui, sans-serif',
    href: googleCss('IBM+Plex+Sans', GOOGLE_WEIGHTS_NO_800),
  },
  {
    id: 'source-sans',
    label: 'Source Sans 3',
    hint: 'Long Inbox reading',
    stack: '"Source Sans 3", system-ui, sans-serif',
    href: googleCss('Source+Sans+3'),
  },
  {
    id: 'roboto',
    label: 'Roboto',
    hint: 'WhatsApp Web and Google Workspace',
    stack: 'Roboto, system-ui, sans-serif',
    href: googleCss('Roboto', GOOGLE_WEIGHTS_ROBOTO),
  },
  {
    id: 'public-sans',
    label: 'Public Sans',
    hint: 'Formal, government-grade UI',
    stack: '"Public Sans", system-ui, sans-serif',
    href: googleCss('Public+Sans'),
  },
  {
    id: 'figtree',
    label: 'Figtree',
    hint: 'Clean admin screens',
    stack: 'Figtree, system-ui, sans-serif',
    href: googleCss('Figtree'),
  },
  {
    id: 'noto',
    label: 'Noto Sans',
    hint: 'Many languages, including Indic scripts',
    stack: '"Noto Sans", system-ui, sans-serif',
    href: googleCss('Noto+Sans'),
  },
  {
    id: 'atkinson',
    label: 'Atkinson Hyperlegible',
    hint: 'Maximum readability on long shifts',
    stack: '"Atkinson Hyperlegible", system-ui, sans-serif',
    href: googleCss('Atkinson+Hyperlegible', GOOGLE_WEIGHTS_ATKINSON),
  },
  {
    id: 'system',
    label: 'System',
    hint: 'Uses the computer font — fastest',
    stack: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    href: null,
  },
];

export function fontFamilyOptionLabel(font: (typeof FONT_FAMILIES)[number]): string {
  if (font.badge === 'default') return `${font.label} (Default)`;
  if (font.badge === 'recommended') return `${font.label} (Recommended)`;
  return font.label;
}

const FONT_BY_ID = Object.fromEntries(FONT_FAMILIES.map((f) => [f.id, f])) as Record<
  FontFamilyId,
  (typeof FONT_FAMILIES)[number]
>;

export function isTextSize(value: string | null): value is TextSize {
  return value === 'small' || value === 'default' || value === 'large';
}

export function isFontFamilyId(value: string | null): value is FontFamilyId {
  return Boolean(value && value in FONT_BY_ID);
}

export function getFontFamily(id: FontFamilyId) {
  return FONT_BY_ID[id];
}

export function getStoredTextSize(): TextSize {
  if (typeof window === 'undefined') return DEFAULT_TEXT_SIZE;
  const stored = localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
  return isTextSize(stored) ? stored : DEFAULT_TEXT_SIZE;
}

export function getStoredFontFamily(): FontFamilyId {
  if (typeof window === 'undefined') return DEFAULT_FONT_FAMILY;
  const stored = localStorage.getItem(FONT_FAMILY_STORAGE_KEY);
  return isFontFamilyId(stored) ? stored : DEFAULT_FONT_FAMILY;
}

const FONT_LINK_ID = 'samyoj-app-font';

function ensureAppFontStylesheet(href: string | null) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(FONT_LINK_ID);
  if (!href) {
    existing?.remove();
    return;
  }
  if (existing instanceof HTMLLinkElement) {
    if (existing.getAttribute('href') === href) return;
    existing.href = href;
    return;
  }
  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

export function applyTextSize(size: TextSize) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.textSize = size;
  root.style.setProperty('--app-root-font-size', TEXT_SIZE_PX[size]);
}

export function applyFontFamily(id: FontFamilyId) {
  if (typeof document === 'undefined') return;
  const font = FONT_BY_ID[id];
  const root = document.documentElement;
  root.dataset.fontFamily = id;
  root.style.setProperty('--app-font-family', font.stack);
  ensureAppFontStylesheet(font.href);
}

export function saveTextSize(size: TextSize) {
  localStorage.setItem(TEXT_SIZE_STORAGE_KEY, size);
  applyTextSize(size);
}

export function saveFontFamily(id: FontFamilyId) {
  localStorage.setItem(FONT_FAMILY_STORAGE_KEY, id);
  applyFontFamily(id);
}
