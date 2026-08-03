import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type TipPlacement = 'above' | 'below' | 'left' | 'right';

/** `onDark` forces light chrome (e.g. MediaViewer black overlay). */
export type TipTone = 'default' | 'onDark';

export type ComposerTipState = {
  text: string;
  top: number;
  left: number;
  placement: TipPlacement;
  tone: TipTone;
} | null;

export type GlassTipShowOptions = {
  placement?: TipPlacement;
  tone?: TipTone;
};

export type GlassTipApi = {
  onShowTip: (text: string, el: HTMLElement, options?: TipPlacement | GlassTipShowOptions) => void;
  onHideTip: () => void;
};

function normalizeShowOptions(
  options?: TipPlacement | GlassTipShowOptions
): { placement: TipPlacement; tone: TipTone } {
  if (!options) return { placement: 'above', tone: 'default' };
  if (typeof options === 'string') return { placement: options, tone: 'default' };
  return {
    placement: options.placement ?? 'above',
    tone: options.tone ?? 'default',
  };
}

const InboxGlassTipContext = createContext<GlassTipApi | null>(null);

/** Half of tip max-width + gutter — used to flip centered tips near viewport edges. */
const CENTER_EDGE_PX = 148;
const VIEWPORT_PAD = 10;

function resolveTip(
  text: string,
  el: HTMLElement,
  preferred: TipPlacement = 'above',
  tone: TipTone = 'default'
): NonNullable<ComposerTipState> {
  const r = el.getBoundingClientRect();
  let placement = preferred;

  // Vertical flip when preferred above/below would clip near the viewport edge.
  if (preferred === 'above' && r.top < 44) placement = 'below';
  if (preferred === 'below' && window.innerHeight - r.bottom < 44) placement = 'above';

  // Centered above/below tips clip at left/right viewport edges — shift to the open side.
  if (placement === 'above' || placement === 'below') {
    const centerX = r.left + r.width / 2;
    if (window.innerWidth - centerX < CENTER_EDGE_PX) placement = 'left';
    else if (centerX < CENTER_EDGE_PX) placement = 'right';
  }

  if (placement === 'left') {
    return {
      text,
      top: r.top + r.height / 2,
      left: r.left - 10,
      placement,
      tone,
    };
  }
  if (placement === 'right') {
    return {
      text,
      top: r.top + r.height / 2,
      left: r.right + 10,
      placement,
      tone,
    };
  }

  return {
    text,
    top: placement === 'above' ? r.top - 10 : r.bottom + 10,
    left: r.left + r.width / 2,
    placement,
    tone,
  };
}

/** After mount, clamp so wrapped tips stay fully inside the viewport. */
function clampTipPosition(
  el: HTMLElement,
  tip: NonNullable<ComposerTipState>
): { top: number; left: number } {
  const rect = el.getBoundingClientRect();
  let { top, left } = tip;
  const pad = VIEWPORT_PAD;

  if (tip.placement === 'left' || tip.placement === 'right') {
    const halfH = rect.height / 2;
    top = Math.min(Math.max(top, halfH + pad), window.innerHeight - halfH - pad);
    if (tip.placement === 'left') {
      // transform: translate(-100%, -50%) → visual left = left - width
      if (left - rect.width < pad) left = rect.width + pad;
    } else if (left + rect.width > window.innerWidth - pad) {
      left = window.innerWidth - pad - rect.width;
    }
  } else {
    const halfW = rect.width / 2;
    left = Math.min(Math.max(left, halfW + pad), window.innerWidth - halfW - pad);
    if (tip.placement === 'above') {
      // transform: translate(-50%, -100%) → visual top = top - height
      if (top - rect.height < pad) top = rect.height + pad;
    } else if (top + rect.height > window.innerHeight - pad) {
      top = window.innerHeight - pad - rect.height;
    }
  }

  return { top, left };
}

/**
 * Soft glassmorphic tip for Inbox icon buttons.
 * Short labels preferred — no native black browser `title` chrome.
 */
export default function ComposerGlassTip({ tip }: { tip: ComposerTipState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!tip) {
      setCoords(null);
      return;
    }
    setCoords({ top: tip.top, left: tip.left });
    const node = ref.current;
    if (!node) return;
    setCoords(clampTipPosition(node, tip));
  }, [tip]);

  if (!tip || typeof document === 'undefined') return null;

  const pos = coords ?? { top: tip.top, left: tip.left };

  const toneClass = tip.tone === 'onDark' ? ' inbox-glass-tip--on-dark' : '';

  return createPortal(
    <div
      ref={ref}
      className={`inbox-glass-tip inbox-glass-tip--${tip.placement}${toneClass}`}
      style={{ top: pos.top, left: pos.left }}
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

  const onShowTip = useCallback(
    (text: string, el: HTMLElement, options?: TipPlacement | GlassTipShowOptions) => {
      if (!text) {
        setTip(null);
        return;
      }
      const { placement, tone } = normalizeShowOptions(options);
      setTip(resolveTip(text, el, placement, tone));
    },
    []
  );

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

/** True when rendered under `InboxGlassTipProvider`. */
export function useInboxGlassTipActive(): boolean {
  return useContext(InboxGlassTipContext) !== null;
}

/** Hover/focus handlers for a short glass label (no native title). */
export function composerTipProps(
  text: string,
  onShowTip: GlassTipApi['onShowTip'],
  onHideTip: () => void,
  options: TipPlacement | GlassTipShowOptions = 'above'
) {
  if (!text) return {};
  return {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => onShowTip(text, e.currentTarget, options),
    onMouseLeave: onHideTip,
    onFocus: (e: FocusEvent<HTMLElement>) => onShowTip(text, e.currentTarget, options),
    onBlur: onHideTip,
  };
}

/** Convenience: tip handlers bound to the Inbox provider. */
export function useGlassTipProps() {
  const { onShowTip, onHideTip } = useInboxGlassTip();
  return useCallback(
    (text: string, options: TipPlacement | GlassTipShowOptions = 'above') =>
      composerTipProps(text, onShowTip, onHideTip, options),
    [onShowTip, onHideTip]
  );
}
