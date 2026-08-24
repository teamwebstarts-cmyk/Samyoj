import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

export const APP_INFO_TOOLTIP_CLASS =
  'app-info-tooltip pointer-events-auto fixed z-[10060] max-w-[min(320px,calc(100vw-1.5rem))] whitespace-normal break-words rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-left text-[12px] font-semibold leading-relaxed text-neutral-950 shadow-[0_12px_40px_rgba(15,23,42,0.2)]';

interface InfoTipProps {
  content: ReactNode;
  label?: string;
  className?: string;
}

const VIEWPORT_PAD = 12;
const TIP_GAP = 8;

function placeTooltip(
  anchor: HTMLElement,
  tipEl: HTMLElement,
): { top: number; left: number; above: boolean } {
  const rect = anchor.getBoundingClientRect();
  const tipW = tipEl.offsetWidth;
  const tipH = tipEl.offsetHeight;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  const centerX = rect.left + rect.width / 2;
  let left = centerX - tipW / 2;
  left = Math.min(Math.max(left, VIEWPORT_PAD), viewportW - tipW - VIEWPORT_PAD);

  const belowTop = rect.bottom + TIP_GAP;
  const aboveTop = rect.top - TIP_GAP - tipH;
  const fitsBelow = belowTop + tipH <= viewportH - VIEWPORT_PAD;
  const fitsAbove = aboveTop >= VIEWPORT_PAD;
  const above = !fitsBelow && fitsAbove;

  let top = above ? aboveTop : belowTop;
  top = Math.min(Math.max(top, VIEWPORT_PAD), viewportH - tipH - VIEWPORT_PAD);

  return { top, left, above };
}

/** Info icon — hover/focus reveals a bright white tooltip with dark text (portaled, never clipped). */
export default function InfoTip({ content, label, className = '' }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const id = useId();
  const ariaLabel =
    typeof content === 'string' ? content : label ?? 'More information';

  const isOpen = open || pinned;

  const updatePosition = () => {
    if (!anchorRef.current || !tipRef.current) return;
    setCoords(placeTooltip(anchorRef.current, tipRef.current));
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      setCoords(null);
      return;
    }
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, content]);

  useEffect(() => {
    if (!pinned) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorRef.current?.contains(target)) return;
      if (tipRef.current?.contains(target)) return;
      setPinned(false);
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [pinned]);

  const popup =
    isOpen &&
    typeof document !== 'undefined' &&
    createPortal(
      <span
        ref={tipRef}
        id={id}
        role="tooltip"
        className={`${APP_INFO_TOOLTIP_CLASS} max-h-[min(50vh,280px)] overflow-y-auto overscroll-contain`}
        style={{
          top: coords?.top ?? -9999,
          left: coords?.left ?? -9999,
          visibility: coords ? 'visible' : 'hidden',
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          if (!pinned) setOpen(false);
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
          aria-describedby={isOpen ? id : undefined}
          aria-expanded={isOpen}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => {
            if (!pinned) setOpen(false);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            if (!pinned) setOpen(false);
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPinned((value) => {
              const next = !value;
              setOpen(next);
              return next;
            });
          }}
        >
          <Info className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        </button>
      </span>
      {popup}
    </>
  );
}
