import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'inbox:widths:v1';
const DEFAULT_LEFT = 340;
const DEFAULT_RIGHT = 340;
const MIN_LEFT = 280;
const MAX_LEFT = 440;
const MIN_RIGHT = 280;
const MAX_RIGHT = 380;

interface StoredWidths {
  left?: number;
  right?: number;
}

function loadStored(): StoredWidths {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredWidths;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStored(value: StoredWidths) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* swallow quota errors */
  }
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export interface PaneWidths {
  left: number;
  right: number;
}

interface UsePaneWidthsApi {
  widths: PaneWidths;
  /** Set absolute left rail width (px); clamped to bounds. */
  setLeft: (px: number) => void;
  /** Set absolute right rail width (px); clamped to bounds. */
  setRight: (px: number) => void;
  leftRailProps: {
    style: { width: number };
    onResize: (widthPx: number) => void;
  };
  rightRailProps: {
    style: { width: number };
    onResize: (widthPx: number) => void;
  };
  reset: () => void;
}

export function usePaneWidths(): UsePaneWidthsApi {
  const initial = loadStored();
  const [left, setLeftState] = useState<number>(() => clamp(initial.left ?? DEFAULT_LEFT, MIN_LEFT, MAX_LEFT));
  const [right, setRightState] = useState<number>(() =>
    clamp(initial.right ?? DEFAULT_RIGHT, MIN_RIGHT, MAX_RIGHT)
  );
  const persistRef = useRef({ left, right });
  persistRef.current = { left, right };

  // Persist whenever widths change (debounced via microtask).
  useEffect(() => {
    const { left: l, right: r } = persistRef.current;
    saveStored({ left: l, right: r });
  }, [left, right]);

  const setLeft = useCallback((px: number) => {
    setLeftState(clamp(px, MIN_LEFT, MAX_LEFT));
  }, []);
  const setRight = useCallback((px: number) => {
    setRightState(clamp(px, MIN_RIGHT, MAX_RIGHT));
  }, []);

  const reset = useCallback(() => {
    setLeftState(DEFAULT_LEFT);
    setRightState(DEFAULT_RIGHT);
  }, []);

  return {
    widths: { left, right },
    setLeft,
    setRight,
    leftRailProps: {
      style: { width: left },
      onResize: setLeft,
    },
    rightRailProps: {
      style: { width: right },
      onResize: setRight,
    },
    reset,
  };
}

export const PANE_BOUNDS = {
  MIN_LEFT,
  MAX_LEFT,
  MIN_RIGHT,
  MAX_RIGHT,
  DEFAULT_LEFT,
  DEFAULT_RIGHT,
};
