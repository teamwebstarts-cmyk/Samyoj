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
  emerald: 'bg-emerald-50 text-emerald-700',
  sky: 'bg-sky-50 text-sky-700',
  violet: 'bg-violet-50 text-violet-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-600',
  slate: 'bg-slate-100 text-slate-600',
  /** Filled brand well for WhatsApp glyph */
  whatsapp: 'bg-[#25D366] text-white',
};

const SIZES = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-10 w-10 sm:h-11 sm:w-11',
} as const;

const RADIUS = {
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-xl',
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
 * Soft tinted icon wells used across the dashboard mock —
 * consistent size, padding, and pastel accent pairing.
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
      ? 'bg-emerald-600 text-white'
      : 'bg-rose-600 text-white';

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <span
        className={`inline-flex items-center justify-center ${SIZES[size]} ${
          round ? 'rounded-full' : RADIUS[size]
        } ${ACCENTS[accent]}`}
      >
        {children}
      </span>
      {showBadge && (
        <span
          className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold tabular-nums leading-none shadow-sm ${badgeCls}`}
        >
          {badgeLabel}
        </span>
      )}
    </span>
  );
}

export { ACCENTS as ICON_WELL_ACCENTS };
