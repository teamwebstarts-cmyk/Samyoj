import { useEffect, useRef } from 'react';

const OVERFLOW_EPS = 1;

function wheelDeltaYPixels(event: WheelEvent, el: HTMLElement): number {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * el.clientHeight;
  return event.deltaY;
}

/**
 * Map vertical mouse wheel to horizontal scroll on a nowrap overflow-x strip.
 * Returns true when the event was converted (and preventDefault called).
 * Leaves page scroll alone when the row does not overflow, Shift already
 * maps to horizontal, or the gesture is already mostly deltaX.
 */
export function applyVerticalWheelToHorizontalScroll(event: WheelEvent, el: HTMLElement): boolean {
  if (event.shiftKey || event.ctrlKey || event.metaKey) return false;
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return false;

  const maxScroll = el.scrollWidth - el.clientWidth;
  if (maxScroll <= OVERFLOW_EPS) return false;

  const delta = wheelDeltaYPixels(event, el);
  if (delta === 0) return false;

  const next = Math.max(0, Math.min(maxScroll, el.scrollLeft + delta));
  if (Math.abs(next - el.scrollLeft) < OVERFLOW_EPS) return false;

  event.preventDefault();
  el.scrollLeft = next;
  return true;
}

/** Native wheel listener: React 18 root `onWheel` is passive, so preventDefault would no-op. */
export function useHorizontalWheelScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      applyVerticalWheelToHorizontalScroll(event, el);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return ref;
}
