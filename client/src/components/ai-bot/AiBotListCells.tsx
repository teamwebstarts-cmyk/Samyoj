import { BookOpen, Hash, MessageSquare } from 'lucide-react';
import { botChip } from './aiBotVisuals';

export function AiBotStartsWhenCell({
  keywords,
  isDefault,
}: {
  keywords: string[];
  isDefault: boolean;
}) {
  if (keywords.length > 0) {
    const shown = keywords.slice(0, 3);
    const extra = keywords.length - shown.length;
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-theme-muted">
          Keywords
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {shown.map((kw) => (
            <span key={kw} className={`${botChip.base} normal-case tracking-normal ${botChip.keyword}`}>
              <Hash className="h-3 w-3 opacity-70" />
              {kw}
            </span>
          ))}
          {extra > 0 ? (
            <span className="text-[11px] font-semibold tabular-nums text-theme-muted">+{extra}</span>
          ) : null}
        </div>
      </div>
    );
  }

  if (isDefault) {
    return (
      <div className="flex items-center gap-2 text-theme-secondary">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-theme-fg">All messages</p>
          <p className="text-[11px] font-medium text-theme-muted">Default inbox bot</p>
        </div>
      </div>
    );
  }

  return <span className="text-[13px] font-medium text-theme-muted">Not set</span>;
}

export function AiBotKnowledgeCell({ count }: { count: number }) {
  if (count <= 0) {
    return (
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
          <BookOpen className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-theme-muted">No FAQs</p>
          <p className="text-[11px] font-medium text-theme-muted">Add training</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
        <BookOpen className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-extrabold tabular-nums leading-none tracking-tight text-theme-fg">
          {count.toLocaleString()}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
          {count === 1 ? 'FAQ trained' : 'FAQs trained'}
        </p>
      </div>
    </div>
  );
}

export function AiBotStatusCell({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] font-bold ${
        enabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-theme-muted'
      }`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {enabled ? (
          <>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </>
        ) : (
          <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-400 dark:bg-neutral-500" />
        )}
      </span>
      {enabled ? 'Live' : 'Paused'}
    </span>
  );
}
