/**
 * Shared accessibility primitives for the Samyoj Inbox:
 *  - useReducedMotion: detect prefers-reduced-motion
 *  - useAutoFocus: focus an element on mount
 *  - useFocusTrap: trap Tab/Shift+Tab inside a dialog; bind Escape
 *  - useRovingTabindex: roving tabindex pattern for chip rows / conversation lists
 *  - FOCUS_RING_CLASS: token-level focus-visible utility
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export const FOCUS_RING_CLASS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp-500 focus-visible:ring-offset-2';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Returns true when the user has requested reduced motion. SSR-safe. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    setReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, []);
  return reduced;
}

/**
 * Auto-focus a single ref'd element on mount. Re-runs when `when` flips to true
 * (e.g. a modal opens). Focus is synchronous; no animation delay.
 */
export function useAutoFocus<T extends HTMLElement>(
  ref: RefObject<T>,
  when = true
): void {
  useEffect(() => {
    if (!when) return;
    const id = window.setTimeout(() => {
      ref.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [when, ref]);
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null
  );
}

/**
 * Trap Tab focus inside a dialog. Restores focus to the previously focused
 * element on close. Also binds Escape to call onEscape.
 */
export function useFocusTrap<T extends HTMLElement>({
  ref,
  active = true,
  onEscape,
}: {
  ref: RefObject<T>;
  active?: boolean;
  onEscape?: () => void;
}): void {
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    previousActiveRef.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscape) {
        event.stopPropagation();
        onEscape();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = focusableElements(container);
      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (current === first || !container.contains(current)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (current === last || !container.contains(current)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const prev = previousActiveRef.current;
      if (prev && typeof prev.focus === 'function') {
        window.setTimeout(() => prev.focus(), 0);
      }
    };
  }, [active, onEscape, ref]);
}

interface RovingTabindexOptions {
  orientation?: 'horizontal' | 'vertical';
  onActivate?: (index: number) => void;
  initialIndex?: number;
}

/**
 * Hook for implementing roving tabindex on a list of elements.
 * Returns the index of the active descendant and helpers to attach to the row.
 */
export function useRovingTabindex(
  count: number,
  options?: RovingTabindexOptions
): {
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  getRowProps: (index: number) => {
    tabIndex: number;
    onKeyDown: (event: React.KeyboardEvent) => void;
    'data-roving-item': string;
  };
  focusActive: () => void;
} {
  const orientation = options?.orientation ?? 'horizontal';
  const initial = Math.min(Math.max(options?.initialIndex ?? 0, 0), Math.max(count - 1, 0));
  const [activeIndex, setActiveIndexState] = useState<number>(initial);

  const clamp = useCallback(
    (i: number) => {
      if (count <= 0) return 0;
      return ((i % count) + count) % count;
    },
    [count]
  );

  const setActiveIndex = useCallback(
    (i: number) => setActiveIndexState(clamp(i)),
    [clamp]
  );

  const focusActive = useCallback(() => {
    const nodes = document.querySelectorAll<HTMLElement>('[data-roving-item]');
    nodes[activeIndex]?.focus();
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (count === 0) return;
      const isVertical = orientation === 'vertical';
      const prev = isVertical ? 'ArrowUp' : 'ArrowLeft';
      const next = isVertical ? 'ArrowDown' : 'ArrowRight';
      switch (event.key) {
        case prev:
          event.preventDefault();
          setActiveIndex(activeIndex - 1);
          window.setTimeout(focusActive, 0);
          return;
        case next:
          event.preventDefault();
          setActiveIndex(activeIndex + 1);
          window.setTimeout(focusActive, 0);
          return;
        case 'Home':
          event.preventDefault();
          setActiveIndex(0);
          window.setTimeout(focusActive, 0);
          return;
        case 'End':
          event.preventDefault();
          setActiveIndex(count - 1);
          window.setTimeout(focusActive, 0);
          return;
        case 'Enter':
        case ' ':
          if (options?.onActivate) {
            event.preventDefault();
            options.onActivate(activeIndex);
          }
          return;
      }
    },
    [activeIndex, count, focusActive, options, orientation, setActiveIndex]
  );

  const getRowProps = useCallback(
    (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      onKeyDown: handleKeyDown,
      'data-roving-item': '',
    }),
    [activeIndex, handleKeyDown]
  );

  return {
    activeIndex,
    setActiveIndex,
    getRowProps,
    focusActive,
  };
}