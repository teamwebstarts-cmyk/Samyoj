import type { ReactNode } from 'react';

export type IconWellAccent =
  | 'emerald'
  | 'sky'
  | 'violet'
  | 'amber'
  | 'rose'
  | 'slate'
  | 'whatsapp';

const ACCENTS: Record<IconWellAccent, string> = {
  emerald:
    'bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-emerald-100/60 text-emerald-700 border border-emerald-200/60 shadow-[0_2px_8px_rgba(16,185,129,0.1)] dark:from-emerald-950/40 dark:to-emerald-900/30 dark:border-emerald-800/50 dark:text-emerald-300',
  sky:
    'bg-gradient-to-br from-sky-50 via-sky-50/80 to-sky-100/60 text-sky-700 border border-sky-200/60 shadow-[0_2px_8px_rgba(14,165,233,0.1)] dark:from-sky-950/40 dark:to-sky-900/30 dark:border-sky-800/50 dark:text-sky-300',
  violet:
    'bg-gradient-to-br from-violet-50 via-violet-50/80 to-violet-100/60 text-violet-700 border border-violet-200/60 shadow-[0_2px_8px_rgba(139,92,246,0.1)] dark:from-violet-950/40 dark:to-violet-900/30 dark:border-violet-800/50 dark:text-violet-300',
  amber:
    'bg-gradient-to-br from-amber-50 via-amber-50/80 to-amber-100/60 text-amber-700 border border-amber-200/60 shadow-[0_2px_8px_rgba(245,158,11,0.1)] dark:from-amber-950/40 dark:to-amber-900/30 dark:border-amber-800/50 dark:text-amber-300',
  rose:
    'bg-gradient-to-br from-rose-50 via-rose-50/80 to-rose-100/60 text-rose-700 border border-rose-200/60 shadow-[0_2px_8px_rgba(244,63,94,0.1)] dark:from-rose-950/40 dark:to-rose-900/30 dark:border-rose-800/50 dark:text-rose-300',
  slate:
    'bg-gradient-to-br from-slate-50 via-slate-50/80 to-slate-100/60 text-slate-700 border border-slate-200/60 shadow-[0_2px_6px_rgba(100,116,139,0.06)] dark:from-slate-900/40 dark:to-slate-800/30 dark:border-slate-700/50 dark:text-slate-300',
  whatsapp:
    'bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white shadow-[0_3px_12px_rgba(37,211,102,0.35)] border border-emerald-400/30',
};

const SIZES = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9 sm:h-10 sm:w-10',
  lg: 'h-10 w-10 sm:h-12 sm:w-12',
} as const;

const RADIUS = {
  sm: 'rounded-xl',
  md: 'rounded-2xl',
  lg: 'rounded-2xl',
} as const;

interface IconWellProps {
  accent: IconWellAccent;
  children: ReactNode;
  size?: keyof typeof SIZES;
  /** Circular well (connection strip / attention badges) */
  round?: boolean;
  className?: string;
  badge?: number | string | null;
  badgeTone?: 'rose' | 'emerald';
}

/**
 * Modern layered icon well with gradient pastel backgrounds,
 * subtle border stroke, and soft ambient shadow.
 */
export default function IconWell({
  accent,
  children,
  size = 'md',
  round = false,
  className = '',
  badge,
  badgeTone = 'rose',
}: IconWellProps) {
  const showBadge = badge !== null && badge !== undefined && badge !== '' && Number(badge) !== 0;
  const badgeLabel =
    typeof badge === 'number' ? (badge > 99 ? '99+' : badge) : badge;
  const badgeCls =
    badgeTone === 'emerald'
      ? 'bg-emerald-600 text-white ring-2 ring-white dark:ring-neutral-900'
      : 'bg-rose-600 text-white ring-2 ring-white dark:ring-neutral-900';

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <span
        className={`inline-flex items-center justify-center transition-all duration-200 ${SIZES[size]} ${
          round ? 'rounded-full' : RADIUS[size]
        } ${ACCENTS[accent]}`}
      >
        {children}
      </span>
      {showBadge && (
        <span
          className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold tabular-nums leading-none shadow-md ${badgeCls}`}
        >
          {badgeLabel}
        </span>
      )}
    </span>
  );
}

export { ACCENTS as ICON_WELL_ACCENTS };
