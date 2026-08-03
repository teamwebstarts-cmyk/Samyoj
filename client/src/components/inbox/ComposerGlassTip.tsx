import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type TipPlacement = 'above' | 'below';

export type ComposerTipState = {
  text: string;
  top: number;
  left: number;
  placement: TipPlacement;
} | null;

export type GlassTipApi = {
  onShowTip: (text: string, el: HTMLElement, placement?: TipPlacement) => void;
  onHideTip: () => void;
};

const InboxGlassTipContext = createContext<GlassTipApi | null>(null);

function resolveTip(
  text: string,
  el: HTMLElement,
  preferred: TipPlacement = 'above'
): NonNullable<ComposerTipState> {
  const r = el.getBoundingClientRect();
  let placement = preferred;
  // Flip when the preferred side would clip near the viewport edge.
  if (preferred === 'above' && r.top < 36) placement = 'below';
  if (preferred === 'below' && window.innerHeight - r.bottom < 36) placement = 'above';

  return {
    text,
    top: placement === 'above' ? r.top - 8 : r.bottom + 8,
    left: r.left + r.width / 2,
    placement,
  };
}

/**
 * Soft glassmorphic tip for Inbox icon buttons.
 * Short labels preferred — no native black browser `title` chrome.
 */
export default function ComposerGlassTip({ tip }: { tip: ComposerTipState }) {
  if (!tip || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`inbox-glass-tip inbox-glass-tip--${tip.placement}`}
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

  const onShowTip = useCallback((text: string, el: HTMLElement, placement: TipPlacement = 'above') => {
    if (!text) {
      setTip(null);
      return;
    }
    setTip(resolveTip(text, el, placement));
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

/** One portal for the whole Inbox — prefer this over per-widget tip state. */
export function InboxGlassTipProvider({ children }: { children: ReactNode }) {
  const { tip, onShowTip, onHideTip } = useComposerGlassTip();
  const api = useMemo(() => ({ onShowTip, onHideTip }), [onShowTip, onHideTip]);

  return (
    <InboxGlassTipContext.Provider value={api}>
      {children}
      <ComposerGlassTip tip={tip} />
    </InboxGlassTipContext.Provider>
  );
}

/** Shared tip API; no-ops outside the Inbox provider (aria-label still covers a11y). */
export function useInboxGlassTip(): GlassTipApi {
  const ctx = useContext(InboxGlassTipContext);
  return ctx ?? { onShowTip: () => undefined, onHideTip: () => undefined };
}

/** Hover/focus handlers for a short glass label (no native title). */
export function composerTipProps(
  text: string,
  onShowTip: (text: string, el: HTMLElement, placement?: TipPlacement) => void,
  onHideTip: () => void,
  placement: TipPlacement = 'above'
) {
  if (!text) return {};
  return {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => onShowTip(text, e.currentTarget, placement),
    onMouseLeave: onHideTip,
    onFocus: (e: FocusEvent<HTMLElement>) => onShowTip(text, e.currentTarget, placement),
    onBlur: onHideTip,
  };
}

/** Convenience: tip handlers bound to the Inbox provider. */
export function useGlassTipProps() {
  const { onShowTip, onHideTip } = useInboxGlassTip();
  return useCallback(
    (text: string, placement: TipPlacement = 'above') =>
      composerTipProps(text, onShowTip, onHideTip, placement),
    [onShowTip, onHideTip]
  );
}
