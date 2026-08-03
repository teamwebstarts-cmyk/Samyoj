import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Loader2, Search, X } from 'lucide-react';

interface SearchInChatBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  matchCount: number;
  activeIndex: number;
  searching: boolean;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

/** Slides under the chat header: in-thread search with match navigation. */
export default function SearchInChatBar({
  query,
  onQueryChange,
  matchCount,
  activeIndex,
  searching,
  onNext,
  onPrev,
  onClose,
}: SearchInChatBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) onPrev();
      else onNext();
    } else if (e.key === 'Escape') {
      // Keep the global "Esc closes chat" shortcut from firing — Esc here
      // dismisses only the search bar.
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-neutral-100 bg-theme-surface px-3 py-2 dark:border-neutral-800/80">
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-neutral-200/80 bg-white px-3 ring-1 ring-neutral-100 transition focus-within:border-amber-500/50 focus-within:ring-amber-500/15 dark:border-neutral-700/60 dark:bg-neutral-900/60 dark:ring-neutral-800">
        <Search className="h-3.5 w-3.5 shrink-0 text-theme-muted" strokeWidth={2.25} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search in this chat"
          className="min-w-0 flex-1 border-0 bg-transparent py-2 text-[13px] text-theme-fg placeholder:text-theme-muted focus:outline-none"
        />
        {searching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-theme-muted" />}
      </div>

      <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-theme-muted">
        {query.trim()
          ? matchCount > 0
            ? `${activeIndex + 1} of ${matchCount}`
            : searching
              ? 'Searching…'
              : 'No matches'
          : ''}
      </span>

      <button
        type="button"
        onClick={onPrev}
        disabled={matchCount === 0}
        aria-label="Previous match"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-theme-border text-theme-secondary transition hover:bg-theme-subtle disabled:opacity-40"
      >
        <ChevronUp className="h-4 w-4" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={matchCount === 0}
        aria-label="Next match"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-theme-border text-theme-secondary transition hover:bg-theme-subtle disabled:opacity-40"
      >
        <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close search"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-theme-muted transition hover:bg-theme-subtle hover:text-theme-fg"
      >
        <X className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );
}
