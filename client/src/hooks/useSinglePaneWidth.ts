import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseSinglePaneWidthOptions {
  storageKey: string;
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
}

interface StoredWidth {
  width?: number;
}

function loadStored(key: string): StoredWidth {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredWidth;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStored(key: string, value: StoredWidth) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* swallow quota errors */
  }
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

interface UseSinglePaneWidthApi {
  width: number;
  setWidth: (px: number) => void;
  controller: {
    width: number;
    onResize: (widthPx: number) => void;
  };
  reset: () => void;
}

export type PaneHandleController = UseSinglePaneWidthApi['controller'];

/**
 * Like usePaneWidths but for a single resizable panel (e.g. Calls details).
 * Persists width to localStorage under the given key.
 */
export function useSinglePaneWidth(
  options: UseSinglePaneWidthOptions,
): UseSinglePaneWidthApi {
  const { storageKey, minWidth, maxWidth, defaultWidth } = options;
  const initial = loadStored(storageKey);
  const [width, setWidthState] = useState<number>(() =>
    clamp(initial.width ?? defaultWidth, minWidth, maxWidth),
  );
  const persistRef = useRef(width);
  persistRef.current = width;

  useEffect(() => {
    saveStored(storageKey, { width: persistRef.current });
  }, [storageKey, width]);

  const setWidth = useCallback(
    (px: number) => {
      setWidthState(clamp(px, minWidth, maxWidth));
    },
    [maxWidth, minWidth],
  );

  const reset = useCallback(() => {
    setWidthState(defaultWidth);
  }, [defaultWidth]);

  return {
    width,
    setWidth,
    controller: {
      width,
      onResize: setWidth,
    },
    reset,
  };
}
