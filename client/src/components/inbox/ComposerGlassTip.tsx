import {
  useCallback,
  useEffect,
  useState,
  type FocusEvent,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';

export type ComposerTipState = {
  text: string;
  top: number;
  left: number;
} | null;

/**
 * Soft glassmorphic tip for composer toolbar icons.
 * Short 2–4 word labels only — no native black `title`, no upload limits.
 */
export default function ComposerGlassTip({ tip }: { tip: ComposerTipState }) {
  if (!tip || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="composer-glass-tip"
      style={{ top: tip.top, left: tip.left }}
      role="tooltip"
    >
      {tip.text}
    </div>,
    document.body
  );
}

export function useComposerGlassTip() {
  const [tip, setTip] = useState<ComposerTipState>(null);

  const onHideTip = useCallback(() => setTip(null), []);

  const onShowTip = useCallback((text: string, el: HTMLElement) => {
    if (!text) {
      setTip(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setTip({
      text,
      top: r.top - 8,
      left: r.left + r.width / 2,
    });
  }, []);

  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [tip]);

  return { tip, onShowTip, onHideTip };
}

/** Hover/focus handlers for a short glass label (no native title). */
export function composerTipProps(
  text: string,
  onShowTip: (text: string, el: HTMLElement) => void,
  onHideTip: () => void
) {
  return {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => onShowTip(text, e.currentTarget),
    onMouseLeave: onHideTip,
    onFocus: (e: FocusEvent<HTMLElement>) => onShowTip(text, e.currentTarget),
    onBlur: onHideTip,
  };
}
