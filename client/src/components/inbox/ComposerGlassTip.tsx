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
  /** Trigger icon/button rect at show time (viewport coords). */
  trigger: { top: number; left: number; right: number; bottom: number; width: number; height: number };
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
/** Clear gap between icon edge and tip — never sit on the cursor/icon. */
const TIP_GAP_PX = 12;

function resolveTip(
  text: string,
  el: HTMLElement,
  preferred: TipPlacement = 'above',
  tone: TipTone = 'default'
): NonNullable<ComposerTipState> {
  const r = el.getBoundingClientRect();
  let placement = preferred;

  // Vertical flip when preferred above/below would clip near the viewport edge.
  // Explicit left/right (e.g. details rail) are never flipped to centered placements.
  if (preferred === 'above' && r.top < 44) placement = 'below';
  if (preferred === 'below' && window.innerHeight - r.bottom < 44) placement = 'above';

  // Centered above/below tips clip at left/right viewport edges — shift to the open side.
  if (placement === 'above' || placement === 'below') {
    const centerX = r.left + r.width / 2;
    if (window.innerWidth - centerX < CENTER_EDGE_PX) placement = 'left';
    else if (centerX < CENTER_EDGE_PX) placement = 'right';
  }

  return {
    text,
    trigger: {
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    },
    placement,
    tone,
  };
}

/**
 * Place tip by absolute top-left pixels (no CSS % translate for placement).
 * Side tips sit fully beside the icon with TIP_GAP_PX clearance.
 */
function placeTipPixels(
  tipEl: HTMLElement,
  tip: NonNullable<ComposerTipState>
): { top: number; left: number } {
  const w = tipEl.offsetWidth;
  const h = tipEl.offsetHeight;
  const { trigger: t, placement } = tip;
  const gap = TIP_GAP_PX;
  const pad = VIEWPORT_PAD;

  let top: number;
  let left: number;

  switch (placement) {
    case 'left':
      // Tip’s right edge = icon.left − gap; vertically centered on icon.
      left = t.left - gap - w;
      top = t.top + t.height / 2 - h / 2;
      break;
    case 'right':
      left = t.right + gap;
      top = t.top + t.height / 2 - h / 2;
      break;
    case 'above':
      left = t.left + t.width / 2 - w / 2;
      top = t.top - gap - h;
      break;
    case 'below':
    default:
      left = t.left + t.width / 2 - w / 2;
      top = t.bottom + gap;
      break;
  }

  // Clamp fully inside viewport (may reduce gap near edges, never center on icon).
  left = Math.min(Math.max(left, pad), window.innerWidth - w - pad);
  top = Math.min(Math.max(top, pad), window.innerHeight - h - pad);

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
    const node = ref.current;
    if (!node) return;
    setCoords(placeTipPixels(node, tip));
  }, [tip]);

  if (!tip || typeof document === 'undefined') return null;

  const toneClass = tip.tone === 'onDark' ? ' inbox-glass-tip--on-dark' : '';
  // Hide until measured so we never flash an unplaced tip over the icon.
  const placed = coords !== null;

  return createPortal(
    <div
      ref={ref}
      className={`inbox-glass-tip inbox-glass-tip--${tip.placement}${toneClass}`}
      style={{
        top: coords?.top ?? 0,
        left: coords?.left ?? 0,
        visibility: placed ? 'visible' : 'hidden',
      }}
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
