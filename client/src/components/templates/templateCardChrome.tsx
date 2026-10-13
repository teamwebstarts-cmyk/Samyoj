import { getCategoryMeta } from './templateUi';

const ribbonSurface: Record<string, { ribbon: string; fold: string }> = {
  MARKETING: {
    ribbon: 'bg-rose-600 text-white shadow-[0_2px_8px_rgba(225,29,72,0.35)]',
    fold: 'bg-rose-800',
  },
  UTILITY: {
    ribbon: 'bg-sky-600 text-white shadow-[0_2px_8px_rgba(2,132,199,0.35)]',
    fold: 'bg-sky-800',
  },
  AUTHENTICATION: {
    ribbon: 'bg-violet-700 text-white shadow-[0_2px_8px_rgba(109,40,217,0.35)]',
    fold: 'bg-violet-900',
  },
};

export function CategoryRibbon({
  category,
  size = 'md',
}: {
  category?: string;
  size?: 'sm' | 'md';
}) {
  const meta = getCategoryMeta(category);
  if (!meta) return null;
  const upper = (category || '').toUpperCase();
  const tone = ribbonSurface[upper] ?? {
    ribbon: 'bg-neutral-700 text-white shadow-md',
    fold: 'bg-neutral-900',
  };
  const compact = size === 'sm';

  return (
    <div
      className={`pointer-events-none absolute left-0 z-10 ${compact ? 'top-2 sm:top-2.5' : 'top-3 sm:top-3.5'}`}
    >
      <span
        className={`relative block rounded-r-md font-extrabold uppercase ${
          compact
            ? `px-2 py-0.5 text-[9px] tracking-[0.07em] sm:px-2.5 sm:py-1 sm:text-[10px] ${tone.ribbon}`
            : `rounded-r-lg px-3.5 py-1.5 text-[11px] tracking-[0.1em] sm:px-4 sm:text-xs md:px-4 md:py-2 md:text-[13px] ${tone.ribbon}`
        }`}
      >
        {meta.label}
      </span>
      <span
        className={`absolute left-0 block ${tone.fold} ${
          compact ? '-bottom-1.5 h-1.5 w-1.5' : '-bottom-2 h-2.5 w-2.5 sm:h-3 sm:w-3 sm:-bottom-2.5'
        }`}
        style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
        aria-hidden
      />
    </div>
  );
}
