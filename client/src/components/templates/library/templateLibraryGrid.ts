/** Card grid + filter chips for Meta template library browse (second section). */
export const LIBRARY_CARDS_GRID_CLASS =
  'grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4';

/** Room for card corner badges that sit inside the card edge. */
export const LIBRARY_CARDS_GRID_PAD_CLASS = 'pl-1.5 pt-1';

export const LIBRARY_CARD_CELL_CLASS = 'flex min-h-0 min-w-0 w-full';

/** Filter chip toolbar: horizontally scrollable on phone, wraps on larger screens. */
export const LIBRARY_CHIPS_ROW_CLASS =
  'flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible';

export const LIBRARY_CHIP_CLASS =
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-neutral-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800';

export const LIBRARY_CHIP_ACTIVE_CLASS =
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-violet-500/60 bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 ring-1 ring-violet-500/30 transition dark:border-violet-500/70 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-500/40';
