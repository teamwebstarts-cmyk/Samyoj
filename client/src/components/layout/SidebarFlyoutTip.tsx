import {
  useCallback,
  useEffect,
  useState,
  type FocusEvent,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';

export type FlyoutTipState = {
  text: string;
  top: number;
  left: number;
} | null;

export type TipHandlers = {
  onShowTip: (text: string, el: HTMLElement) => void;
  onHideTip: () => void;
};

/** Soft glass tip that replaces native black browser tooltips on the collapsed rail. */
export function SidebarFlyoutTip({ tip }: { tip: FlyoutTipState }) {
  if (!tip || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="sidebar-flyout-tip"
      style={{ top: tip.top, left: tip.left }}
      role="tooltip"
    >
      <span className="sidebar-flyout-tip__arrow" aria-hidden />
      <span className="sidebar-flyout-tip__label">{tip.text}</span>
    </div>,
    document.body,
  );
}

export function useSidebarFlyoutTip(enabled: boolean) {
  const [tip, setTip] = useState<FlyoutTipState>(null);

  const onHideTip = useCallback(() => setTip(null), []);

  const onShowTip = useCallback(
    (text: string, el: HTMLElement) => {
      if (!enabled || !text) {
        setTip(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setTip({
        text,
        top: r.top + r.height / 2,
        left: r.right + 12,
      });
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) setTip(null);
  }, [enabled]);

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

export function tipProps(
  enabled: boolean,
  text: string,
  onShowTip: (text: string, el: HTMLElement) => void,
  onHideTip: () => void,
) {
  if (!enabled) return {};
  return {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => onShowTip(text, e.currentTarget),
    onMouseLeave: onHideTip,
    onFocus: (e: FocusEvent<HTMLElement>) => onShowTip(text, e.currentTarget),
    onBlur: onHideTip,
  };
}
