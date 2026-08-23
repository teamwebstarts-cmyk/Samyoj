import { useId, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';

interface InfoTipProps {
  content: ReactNode;
  label?: string;
  className?: string;
}

/** Info icon — hover/focus reveals a white tooltip with black text. */
export default function InfoTip({ content, label, className = '' }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ariaLabel =
    typeof content === 'string' ? content : label ?? 'More information';

  return (
    <span
      className={`relative inline-flex shrink-0 align-middle ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full text-slate-400 transition hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 dark:text-slate-500 dark:hover:text-slate-300"
        aria-label={ariaLabel}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-1.5 w-max max-w-[min(280px,calc(100vw-2rem))] -translate-x-1/2 whitespace-normal break-words rounded-lg bg-white px-3 py-2.5 text-left text-[11px] font-medium leading-relaxed text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.16)] ring-1 ring-slate-200/80 dark:bg-white dark:text-slate-900 dark:ring-slate-300/70"
        >
          {content}
          <span
            className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-white ring-1 ring-slate-200/80 dark:bg-white dark:ring-slate-300/70"
            aria-hidden
          />
        </span>
      )}
    </span>
  );
}
