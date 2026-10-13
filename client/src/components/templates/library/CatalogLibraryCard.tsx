import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  CheckCircle2,
  CreditCard,
  FileImage,
  FileText,
  FileType,
  Film,
  Gift,
  KeyRound,
  MapPin,
  MessageSquare,
  Package,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
  UserRound,
} from 'lucide-react';
import type { CatalogListItem } from '../../../utils/templateLibrary';
import { getCategoryMeta } from '../templateUi';
import { CategoryRibbon } from '../templateCardChrome';

const ICON_MAP: Record<string, LucideIcon> = {
  package: Package,
  truck: Truck,
  pin: MapPin,
  calendar: Calendar,
  card: CreditCard,
  user: UserRound,
  shield: ShieldCheck,
  key: KeyRound,
  store: Store,
  sparkles: Sparkles,
  cart: ShoppingCart,
  gift: Gift,
  check: CheckCircle2,
  message: MessageSquare,
};

function iconFor(item: CatalogListItem): LucideIcon {
  if (item.icon && ICON_MAP[item.icon]) return ICON_MAP[item.icon];
  if (item.category === 'AUTHENTICATION') return KeyRound;
  if (item.category === 'MARKETING') return Sparkles;
  return FileText;
}

function CatalogHeroVisual({ entry }: { entry: CatalogListItem }) {
  const category = getCategoryMeta(entry.category);
  const Icon = iconFor(entry);
  const format = entry.mediaFormat;
  const mediaIconClass = 'h-9 w-9 shrink-0 sm:h-10 sm:w-10 md:h-11 md:w-11';

  if (format === 'IMAGE') {
    return <FileImage className={`${mediaIconClass} text-sky-600 dark:text-sky-400`} strokeWidth={1.75} />;
  }
  if (format === 'VIDEO') {
    return <Film className={`${mediaIconClass} text-violet-600 dark:text-violet-400`} strokeWidth={1.75} />;
  }
  if (format === 'DOCUMENT') {
    return <FileType className={`${mediaIconClass} text-amber-700 dark:text-amber-400`} strokeWidth={1.75} />;
  }

  return (
    <div
      className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-md sm:h-12 sm:w-12 md:h-12 md:w-12 lg:h-12 lg:w-12 xl:h-14 xl:w-14 ${category?.iconBg ?? 'bg-gradient-to-br from-rose-500 to-pink-600'}`}
    >
      <Icon className="h-6 w-6 sm:h-7 sm:w-7 md:h-7 md:w-7 lg:h-7 lg:w-7 xl:h-8 xl:w-8" strokeWidth={2} />
    </div>
  );
}

function LibrarySourceBadges({ entry }: { entry: CatalogListItem }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {entry.ready ? (
        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50 sm:text-[11px]">
          Ready now
        </span>
      ) : entry.source === 'meta' ? (
        <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 ring-1 ring-violet-200/80 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/50 sm:text-[11px]">
          Meta library
        </span>
      ) : null}
      {entry.mediaFormat ? (
        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 ring-1 ring-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/50 sm:text-[11px]">
          {entry.mediaFormat} header
        </span>
      ) : null}
    </div>
  );
}

/** Vertical rhythm between hero, title block, badges, and preview (title ↔ subtitle stays tighter inside its block). */
const CARD_SECTION_GAP = 'gap-2';

interface CatalogLibraryCardProps {
  entry: CatalogListItem;
  selected: boolean;
  previewText: string;
  onSelect: () => void;
}

export default function CatalogLibraryCard({ entry, selected, previewText, onSelect }: CatalogLibraryCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border text-left shadow-sm transition ${
        selected
          ? 'border-violet-400 bg-violet-50/70 ring-2 ring-violet-400/40 dark:border-violet-600 dark:bg-violet-950/25 dark:ring-violet-500/30'
          : 'border-neutral-200/90 bg-white hover:border-neutral-300 hover:bg-neutral-50/80 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700 dark:hover:bg-neutral-900/50'
      }`}
    >
      <CategoryRibbon category={entry.category} size="sm" />

      <div
        className={`flex min-h-0 flex-1 flex-col ${CARD_SECTION_GAP} px-3 pb-2.5 pt-8 sm:px-3.5 sm:pt-9`}
      >
        <div className="flex shrink-0 justify-center">
          <CatalogHeroVisual entry={entry} />
        </div>

        <div className="flex min-h-[3.125rem] shrink-0 flex-col items-center gap-0.5">
          <h3 className="text-center text-[13px] font-bold leading-tight text-neutral-900 sm:text-sm dark:text-neutral-100">
            <span className="line-clamp-2 break-words">{entry.title}</span>
          </h3>
          <p className="line-clamp-1 min-h-[1rem] text-center text-[10px] font-medium leading-tight text-neutral-400 sm:text-[11px]">
            {entry.copy || '\u00a0'}
          </p>
        </div>

        <div className="flex min-h-[1.375rem] shrink-0 items-center justify-center">
          <LibrarySourceBadges entry={entry} />
        </div>

        <div className="flex min-h-[3.75rem] flex-1 flex-col justify-start text-center">
          {previewText ? (
            <p
              className="mx-auto line-clamp-3 max-w-full min-h-[3.75rem] overflow-hidden text-ellipsis text-xs leading-5 text-neutral-600 dark:text-neutral-400"
              title={previewText}
            >
              {previewText}
            </p>
          ) : (
            <p className="min-h-[3.75rem] text-xs leading-5 text-neutral-400">No preview text</p>
          )}
        </div>
      </div>

      <div
        className={`flex shrink-0 items-center justify-center gap-1.5 border-t px-3 py-2.5 sm:px-3.5 ${
          selected
            ? 'border-violet-200/80 bg-violet-100/50 dark:border-violet-800 dark:bg-violet-950/40'
            : 'border-neutral-200/80 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-900/30'
        }`}
      >
        {selected ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-violet-600 dark:text-violet-400" strokeWidth={2.25} aria-hidden />
            <span className="text-xs font-bold text-violet-700 sm:text-[13px] dark:text-violet-300">Selected</span>
          </>
        ) : (
          <span className="text-xs font-semibold text-neutral-600 sm:text-[13px] dark:text-neutral-400">
            Select template
          </span>
        )}
      </div>
    </button>
  );
}
