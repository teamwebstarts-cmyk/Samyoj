import { CheckSquare, Loader2, Square, Trash2, X } from 'lucide-react';
import { useGlassTipProps } from '../inbox/ComposerGlassTip';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';

interface CallsBulkBarProps {
  count: number;
  allVisibleSelected: boolean;
  busy: boolean;
  onSelectAll: () => void;
  onDelete: () => void;
  onClear: () => void;
}

const ACTION_BTN =
  `inline-flex h-8 w-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-theme-border ` +
  `px-0 text-[11px] font-bold text-theme-secondary transition hover:bg-theme-subtle hover:text-theme-fg ` +
  `disabled:opacity-50 @[300px]:w-auto @[300px]:gap-1.5 @[300px]:px-2.5`;

/** Sticky bar at the top of Recents while call history rows are selected. */
export default function CallsBulkBar({
  count,
  allVisibleSelected,
  busy,
  onSelectAll,
  onDelete,
  onClear,
}: CallsBulkBarProps) {
  const tipFor = useGlassTipProps();

  return (
    <div
      className="@container inbox-modal-enter sticky top-0 z-40 flex shrink-0 items-center gap-1 border-b border-neutral-100 bg-theme-surface/95 px-2 py-2 backdrop-blur-md dark:border-neutral-800/80 motion-reduce:animate-none @[300px]:gap-1.5 @[300px]:px-3"
      data-testid="calls-bulk-bar"
    >
      <span
        aria-label={`${count} selected`}
        className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-whatsapp-400 to-whatsapp-600 px-1.5 text-[11px] font-bold text-white shadow-[0_1px_4px_rgba(37,211,102,0.35)]"
      >
        {count}
      </span>

      {busy && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-theme-muted" />}

      <div className="ml-auto flex min-w-0 items-center gap-1 @[300px]:gap-1.5">
        <button
          type="button"
          disabled={busy}
          aria-label={allVisibleSelected ? 'Deselect all on this page' : 'Select all on this page'}
          {...tipFor(allVisibleSelected ? 'Deselect page' : 'Select all')}
          onClick={onSelectAll}
          className={`${ACTION_BTN} ${FOCUS_RING_CLASS}`}
          data-testid="calls-select-all"
        >
          {allVisibleSelected ? (
            <Square className="h-3.5 w-3.5 text-neutral-500" strokeWidth={2.25} />
          ) : (
            <CheckSquare className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.25} />
          )}
          <span className="hidden @[300px]:inline">
            {allVisibleSelected ? 'Deselect' : 'Select all'}
          </span>
        </button>

        <button
          type="button"
          disabled={busy}
          aria-label="Delete selected"
          {...tipFor('Delete selected')}
          onClick={onDelete}
          className={`${ACTION_BTN} border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40 ${FOCUS_RING_CLASS}`}
          data-testid="calls-bulk-delete"
        >
          <Trash2 className="h-3.5 w-3.5 text-rose-500" strokeWidth={2.25} />
          <span className="hidden @[300px]:inline">Delete</span>
        </button>

        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          {...tipFor('Clear selection')}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-theme-muted transition hover:bg-theme-subtle hover:text-theme-fg ${FOCUS_RING_CLASS}`}
        >
          <X className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
