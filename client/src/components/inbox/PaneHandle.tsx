import { useCallback, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

interface PaneHandleProps {
  /** Absolute target width in px (not a delta). */
  onResize: (widthPx: number) => void;
  /** "left" means the handle sits on the LEFT rail's right edge. The user drags
   * right to grow the left rail, so positive pointer delta increases width. */
  side: 'left' | 'right';
  width: number;
  ariaLabel: string;
}

/**
 * R4 — draggable vertical separator. 6px wide col-resize handle with full ARIA
 * semantics (role="separator", aria-orientation, aria-valuemin/max/now).
 * Drag uses absolute `startWidth + signedDelta` so mousemove/pointermove never
 * double-applies cumulative travel.
 */
export default function PaneHandle({ onResize, side, width, ariaLabel }: PaneHandleProps) {
  const startRef = useRef<{ x: number; startWidth: number; pointerId: number } | null>(null);

  const applyPointerDelta = useCallback(
    (clientX: number) => {
      const start = startRef.current;
      if (!start) return;
      const delta = clientX - start.x;
      const sign = side === 'left' ? 1 : -1;
      onResize(start.startWidth + sign * delta);
    },
    [onResize, side]
  );

  const endDrag = useCallback((pointerId?: number) => {
    const start = startRef.current;
    if (!start) return;
    if (pointerId != null && start.pointerId !== pointerId) return;
    startRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!startRef.current || e.pointerId !== startRef.current.pointerId) return;
      applyPointerDelta(e.clientX);
    },
    [applyPointerDelta]
  );

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      if (!startRef.current || e.pointerId !== startRef.current.pointerId) return;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      endDrag(e.pointerId);
    },
    [endDrag, onPointerMove]
  );

  const begin = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startRef.current = { x: e.clientX, startWidth: width, pointerId: e.pointerId };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const delta = (e.key === 'ArrowRight' ? 8 : -8) * (side === 'left' ? 1 : -1);
      onResize(width + delta);
    }
  };

  const style: CSSProperties = {
    width: 6,
    touchAction: 'none',
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      aria-valuemin={1}
      aria-valuemax={1000}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={begin}
      onKeyDown={onKeyDown}
      style={style}
      className="inbox-pane-handle -ml-[3px] mr-[-3px] shrink-0 self-stretch bg-transparent transition-colors hover:bg-whatsapp-500/30 focus:bg-whatsapp-500/40 focus:outline-none"
    />
  );
}
