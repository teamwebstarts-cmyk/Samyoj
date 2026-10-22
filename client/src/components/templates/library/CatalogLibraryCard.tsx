import { CheckCircle2, Eye, KeyRound, Package, Sparkles, Store, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CatalogListItem } from '../../../utils/templateLibrary';
import { splitBodyParts } from './libraryBody';

const CATEGORY_TONE: Record<string, { badge: string; tile: string }> = {
  UTILITY: {
    badge: 'bg-sky-500/95 text-white',
    tile: 'bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/60',
  },
  AUTHENTICATION: {
    badge: 'bg-violet-500/95 text-white',
    tile: 'bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900/60',
  },
};

const TOP_CATEGORY: Record<string, string> = {
  UTILITY: 'Utility',
  AUTHENTICATION: 'OTP',
  MARKETING: 'Marketing',
};

const TILE_ICON: Record<string, LucideIcon> = {
  package: Package,
  truck: Truck,
  store: Store,
  sparkles: Sparkles,
  key: KeyRound,
  check: CheckCircle2,
};

/** Same icon the card tile shows — shared with the footer picker chip. */
export function tileIconFor(item: CatalogListItem): LucideIcon {
  if (item.icon && TILE_ICON[item.icon]) return TILE_ICON[item.icon];
  return item.category === 'AUTHENTICATION' ? KeyRound : Package;
}

const VARIABLE_CHIP =
  'mx-px inline-flex translate-y-px items-center rounded-md bg-emerald-50 px-1 py-0.5 font-mono text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800/60';

interface CatalogLibraryCardProps {
  entry: CatalogListItem;
  selected: boolean;
  previewText: string;
  onSelect: () => void;
}

export default function CatalogLibraryCard({ entry, selected, previewText, onSelect }: CatalogLibraryCardProps) {
  const tone = CATEGORY_TONE[(entry.category || '').toUpperCase()] ?? CATEGORY_TONE.UTILITY;
  const topCategory = TOP_CATEGORY[(entry.category || '').toUpperCase()] ?? 'Utility';
  const TileIcon = tileIconFor(entry);
  const parts = previewText ? splitBodyParts(previewText) : [];

  return (
    <div
      className={`relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border bg-white transition dark:bg-neutral-950 ${
        selected
          ? 'border-emerald-400/70 shadow-[0_0_0_2px_rgba(16,185,129,0.25)] dark:border-emerald-600/70 dark:shadow-[0_0_0_2px_rgba(16,185,129,0.2)]'
          : 'border-neutral-200/90 shadow-sm hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:hover:border-neutral-700'
      }`}
    >
      {/* Top-left category badge (top-category emphasis, mirrors the mock) */}
      <span
        className={`absolute left-3 top-3 z-10 rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.06em] ${tone.badge}`}
      >
        {topCategory}
      </span>
      {selected && (
        <span className="absolute right-3 top-3 z-10" aria-hidden>
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.25} />
        </span>
      )}

      <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 px-3 pb-3 pt-9 sm:px-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ${tone.tile}`}>
          <TileIcon className="h-7 w-7" strokeWidth={2} aria-hidden />
        </div>

        {/* min-h holds the 2-line clamp space so every card in a row is the same height */}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-center text-[13px] font-bold leading-tight text-neutral-900 sm:text-sm dark:text-neutral-100">
          {entry.title}
        </h3>

        <BodyPreview parts={parts} hasText={Boolean(previewText)} />
      </div>

      {/* Single action — picking a card is what opens the WhatsApp preview bar */}
      <div className="shrink-0 border-t border-neutral-100 p-2 dark:border-neutral-800">
        <button
          type="button"
          onClick={onSelect}
          className={`inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border px-2 text-[12px] font-bold transition ${
            selected
              ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-600/90 dark:bg-emerald-600/90 dark:hover:bg-emerald-500'
              : 'border-neutral-200/90 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
          }`}
        >
          {selected ? (
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          ) : (
            <Eye className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          )}
          Preview
        </button>
      </div>
    </div>
  );
}

function BodyPreview({ parts, hasText }: { parts: ReturnType<typeof splitBodyParts>; hasText: boolean }) {
  return (
    <div className="mt-0.5 w-full text-center">
      {hasText ? (
        <p className="line-clamp-3 text-[11.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          {parts.map((part, index) =>
            part.type === 'var' ? (
              <span key={index} className={VARIABLE_CHIP}>
                {part.value}
              </span>
            ) : (
              <span key={index}>{part.value}</span>
            ),
          )}
        </p>
      ) : (
        <p className="line-clamp-3 text-[11.5px] leading-relaxed text-neutral-400">No preview text</p>
      )}
    </div>
  );
}
