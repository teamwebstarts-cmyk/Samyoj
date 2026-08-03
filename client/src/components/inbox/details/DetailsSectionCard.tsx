import type { ReactNode } from 'react';

/** Soft glass inner card used by details-panel sections (mock-aligned, theme-safe). */
export function DetailsSectionCard({
  children,
  className = '',
  'data-section': dataSection,
}: {
  children: ReactNode;
  className?: string;
  'data-section'?: string;
}) {
  return (
    <section
      data-section={dataSection}
      className={`rounded-2xl border border-white/70 bg-white/55 p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/55 dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.25)] ${className}`}
    >
      {children}
    </section>
  );
}

export function DetailsSectionHeader({
  icon,
  title,
  action,
}: {
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        {icon ? (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-theme-secondary">
            {icon}
          </span>
        ) : null}
        <p className="truncate text-[13px] font-bold tracking-tight text-theme-fg">{title}</p>
      </div>
      {action}
    </div>
  );
}

export function detailsAddLinkClassName(extra = '') {
  return `shrink-0 text-[12px] font-semibold text-slate-500 transition hover:text-whatsapp-700 dark:text-slate-400 dark:hover:text-whatsapp-400 ${extra}`;
}

/** API default when a label is created without a color picker choice. */
export const DEFAULT_LABEL_COLOR = '#6366f1';

export type SoftPillTriple = {
  backgroundColor: string;
  borderColor: string;
  color: string;
};

/**
 * Curated solid-pastel chip tokens (mock-aligned).
 * Light: soft fill + light border + fully saturated text (never muddy brown).
 * Dark: tinted surfaces that stay visible on dark panels.
 */
const LABEL_SOFT_PALETTE: ReadonlyArray<{ light: SoftPillTriple; dark: SoftPillTriple }> = [
  {
    // Green
    light: { backgroundColor: '#ECFDF3', borderColor: '#C6F4D7', color: '#16A34A' },
    dark: { backgroundColor: '#052e16', borderColor: '#166534', color: '#4ADE80' },
  },
  {
    // Orange / amber
    light: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA', color: '#D97706' },
    dark: { backgroundColor: '#431407', borderColor: '#9A3412', color: '#FB923C' },
  },
  {
    // Purple / violet
    light: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE', color: '#7C3AED' },
    dark: { backgroundColor: '#2e1065', borderColor: '#6D28D9', color: '#C4B5FD' },
  },
  {
    // Rose
    light: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3', color: '#E11D48' },
    dark: { backgroundColor: '#4c0519', borderColor: '#9F1239', color: '#FB7185' },
  },
  {
    // Blue
    light: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', color: '#2563EB' },
    dark: { backgroundColor: '#172554', borderColor: '#1D4ED8', color: '#93C5FD' },
  },
  {
    // Teal
    light: { backgroundColor: '#F0FDFA', borderColor: '#99F6E4', color: '#0D9488' },
    dark: { backgroundColor: '#042f2e', borderColor: '#0F766E', color: '#5EEAD4' },
  },
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

function normalizeHex(hex: string): string {
  const raw = hex.replace('#', '').trim();
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.padEnd(6, '0').slice(0, 6);
  return `#${full.toLowerCase()}`;
}

function parseRgb(hex: string): { r: number; g: number; b: number } {
  const full = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(full.slice(0, 2), 16) || 100,
    g: Number.parseInt(full.slice(2, 4), 16) || 116,
    b: Number.parseInt(full.slice(4, 6), 16) || 139,
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = Math.max(0, Math.min(1, s));
  const light = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rn = 0;
  let gn = 0;
  let bn = 0;
  if (hp < 1) [rn, gn, bn] = [c, x, 0];
  else if (hp < 2) [rn, gn, bn] = [x, c, 0];
  else if (hp < 3) [rn, gn, bn] = [0, c, x];
  else if (hp < 4) [rn, gn, bn] = [0, x, c];
  else if (hp < 5) [rn, gn, bn] = [x, 0, c];
  else [rn, gn, bn] = [c, 0, x];
  const m = light - c / 2;
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(rn)}${toHex(gn)}${toHex(bn)}`;
}

/** Map any custom hue to solid pastel bg + light border + saturated text. */
function softPastelFromHex(hex: string, dark: boolean): SoftPillTriple {
  const { r, g, b } = parseRgb(hex);
  const { h, s } = rgbToHsl(r, g, b);
  // Keep hue; bump saturation so text never looks muddy/brown.
  const sat = Math.max(0.55, Math.min(0.85, s < 0.15 ? 0.65 : s));
  if (dark) {
    return {
      backgroundColor: hslToHex(h, Math.min(0.55, sat), 0.14),
      borderColor: hslToHex(h, Math.min(0.6, sat), 0.32),
      color: hslToHex(h, Math.min(0.75, sat + 0.1), 0.68),
    };
  }
  return {
    backgroundColor: hslToHex(h, Math.min(0.55, sat), 0.95),
    borderColor: hslToHex(h, Math.min(0.55, sat), 0.84),
    color: hslToHex(h, Math.min(0.8, sat + 0.05), 0.42),
  };
}

function isDefaultOrMissingColor(hex: string | null | undefined): boolean {
  if (!hex || !hex.trim()) return true;
  const n = normalizeHex(hex);
  // Shared API default (all chips looked identical) + legacy slate fallback.
  return n === DEFAULT_LABEL_COLOR || n === '#64748b';
}

/** Resolve the hue used for a soft pill — custom hex wins; else stable palette hash. */
export function resolveLabelPillHex(hex: string | null | undefined, seed?: string): string {
  if (!isDefaultOrMissingColor(hex)) return normalizeHex(hex!);
  const key = (seed || '').trim() || 'label';
  return LABEL_SOFT_PALETTE[hashSeed(key) % LABEL_SOFT_PALETTE.length].light.color;
}

export type SoftLabelPillOptions = {
  /** Prefer label id (stable); name is fine for tags / fallbacks. */
  seed?: string;
  /** When omitted, reads `document.documentElement.dark`. Prefer passing from `useTheme`. */
  dark?: boolean;
};

/**
 * Soft pastel pill colors (solid triples — mock-aligned).
 * Custom stored colors keep their hue with soft fill / light border / saturated text.
 * Missing or default indigo → distinct curated palette entry from `seed` (id/name hash).
 */
export function softLabelPillStyle(
  hex: string | null | undefined,
  seedOrOptions?: string | SoftLabelPillOptions,
): SoftPillTriple {
  const opts: SoftLabelPillOptions =
    typeof seedOrOptions === 'string' ? { seed: seedOrOptions } : (seedOrOptions ?? {});
  const dark =
    opts.dark ??
    (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  if (isDefaultOrMissingColor(hex)) {
    const key = (opts.seed || '').trim() || 'label';
    const entry = LABEL_SOFT_PALETTE[hashSeed(key) % LABEL_SOFT_PALETTE.length];
    return dark ? entry.dark : entry.light;
  }

  return softPastelFromHex(normalizeHex(hex!), dark);
}

/** Shared chip layout — mock: 36px tall, 16px radius, 14px/500, 16px pad. */
export const softLabelPillClassName =
  'inline-flex h-9 max-w-full items-center gap-1 rounded-[16px] border py-2 pl-4 pr-2.5 text-sm font-medium';

/** Compact list-row variant of soft label chips (conversation status, etc.). */
export const softStatusPillClassName =
  'inline-flex h-6 shrink-0 items-center rounded-[10px] border px-2 text-[11px] font-medium tracking-wide';

export const softLabelPillPickerClassName =
  'inline-flex h-9 items-center rounded-[16px] border px-4 py-2 text-sm font-medium transition hover:opacity-90';

export const softLabelPillCloseClassName =
  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-current opacity-80 transition hover:bg-black/10 hover:opacity-100 focus-visible:bg-black/10 focus-visible:opacity-100 focus-visible:outline-none dark:hover:bg-white/15';

/**
 * List-row status chips — one step richer/darker than sidebar label pastels
 * so compact pills read clearly in the conversation list.
 */
const STATUS_SOFT_DENSE: Record<string, { light: SoftPillTriple; dark: SoftPillTriple }> = {
  OPEN: {
    light: { backgroundColor: '#D1FAE5', borderColor: '#86EFAC', color: '#15803D' },
    dark: { backgroundColor: '#064e3b', borderColor: '#15803d', color: '#4ADE80' },
  },
  PENDING: {
    light: { backgroundColor: '#EDE9FE', borderColor: '#C4B5FD', color: '#6D28D9' },
    dark: { backgroundColor: '#3b0764', borderColor: '#7C3AED', color: '#C4B5FD' },
  },
  SNOOZED: {
    light: { backgroundColor: '#FFEDD5', borderColor: '#FDBA74', color: '#C2410C' },
    dark: { backgroundColor: '#7c2d12', borderColor: '#C2410C', color: '#FB923C' },
  },
  CLOSED: {
    light: { backgroundColor: '#E2E8F0', borderColor: '#CBD5E1', color: '#334155' },
    dark: { backgroundColor: '#1e293b', borderColor: '#475569', color: '#94A3B8' },
  },
};

export function softStatusPillStyle(
  status: string,
  options?: SoftLabelPillOptions,
): SoftPillTriple {
  const entry = STATUS_SOFT_DENSE[status] ?? STATUS_SOFT_DENSE.CLOSED;
  const dark =
    options?.dark ??
    (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  return dark ? entry.dark : entry.light;
}
