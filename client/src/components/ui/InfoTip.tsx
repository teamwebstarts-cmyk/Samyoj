import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

export const APP_INFO_TOOLTIP_CLASS =
  'app-info-tooltip pointer-events-none fixed z-[400] w-max max-w-[min(300px,calc(100vw-1.5rem))] whitespace-normal break-words rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-left text-[12px] font-semibold leading-relaxed text-neutral-950 shadow-[0_12px_40px_rgba(15,23,42,0.2)]';

interface InfoTipProps {
  content: ReactNode;
  label?: string;
  className?: string;
}

function placeTooltip(anchor: HTMLElement): { top: number; left: number; above: boolean } {
  const rect = anchor.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const below = rect.bottom + 8;
  const above = rect.top - 8;
  const viewportH = window.innerHeight;
  const preferBelow = below + 120 < viewportH || rect.top < viewportH / 2;
  return {
    top: preferBelow ? below : above,
    left: centerX,
    above: !preferBelow,
  };
}

/** Info icon — hover/focus reveals a bright white tooltip with dark text (portaled, never clipped). */
export default function InfoTip({ content, label, className = '' }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const ariaLabel =
    typeof content === 'string' ? content : label ?? 'More information';

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setCoords(null);
      return;
    }
    const update = () => {
      if (anchorRef.current) setCoords(placeTooltip(anchorRef.current));
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const popup =
    open &&
    coords &&
    typeof document !== 'undefined' &&
    createPortal(
      <span
        id={id}
        role="tooltip"
        className={APP_INFO_TOOLTIP_CLASS}
        style={{
          top: coords.top,
          left: coords.left,
          transform: coords.above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        }}
      >
        {content}
      </span>,
      document.body,
    );

  return (
    <>
      <span className={`relative inline-flex shrink-0 align-middle ${className}`}>
        <button
          ref={anchorRef}
          type="button"
          className="inline-flex items-center justify-center rounded-full text-slate-400 transition hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 dark:text-slate-500 dark:hover:text-slate-300"
          aria-label={ariaLabel}
          aria-describedby={open ? id : undefined}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={(e) => {
            e.preventDefault();
            setOpen((v) => !v);
          }}
        >
          <Info className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        </button>
      </span>
      {popup}
    </>
  );
}
