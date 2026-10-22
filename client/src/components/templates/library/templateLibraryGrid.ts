/** Card grid + filter chips for Meta template library browse (second section).
 * 2-up on phones, 3-up from tablet/laptop width, 4-up on very wide screens;
 * rows stay equal-height (cards stretch, clamped text keeps content uniform). */
export const LIBRARY_CARDS_GRID_CLASS =
  'grid grid-cols-2 items-stretch gap-2.5 sm:gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-3 min-[1800px]:grid-cols-4';

/** Room for card corner badges that sit inside the card edge. */
export const LIBRARY_CARDS_GRID_PAD_CLASS = 'pl-1.5 pt-1';

export const LIBRARY_CARD_CELL_CLASS = 'flex min-h-0 min-w-0 w-full';

/** Filter chip toolbar: single horizontally scrollable row (like the mock's card chips). */
export const LIBRARY_CHIPS_ROW_CLASS = 'app-thin-scroll flex items-center gap-2 overflow-x-auto pb-1 overscroll-x-contain';

/** Shared chip geometry — active/inactive differ only in state colors. */
const CHIP_BASE =
  'inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl border bg-white px-3 py-2 text-left transition dark:bg-neutral-900';

export const LIBRARY_CHIP_CLASS = `${CHIP_BASE} border-neutral-200/90 hover:border-neutral-300 hover:bg-neutral-50/80 dark:border-neutral-800 dark:hover:border-neutral-600`;

export const LIBRARY_CHIP_ACTIVE_CLASS = `${CHIP_BASE} border-emerald-500/60 ring-1 ring-emerald-500/20 dark:border-emerald-500/70 dark:ring-emerald-500/30`;

/** Category tile visuals shared by the card, footer chip, and any picker surface. */
export const LIBRARY_TILE_CLASS: Record<string, string> = {
  UTILITY: 'bg-sky-50 text-sky-600 ring-1 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/60',
  AUTHENTICATION:
    'bg-violet-50 text-violet-600 ring-1 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900/60',
};

export function libraryTileClass(category?: string): string {
  return LIBRARY_TILE_CLASS[(category || '').toUpperCase()] ?? LIBRARY_TILE_CLASS.UTILITY;
}
