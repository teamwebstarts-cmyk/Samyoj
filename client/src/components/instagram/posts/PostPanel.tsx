import { useEffect, useRef, type ReactNode } from 'react';
import { Eye, MessageSquare, Pencil, X } from 'lucide-react';
import { FOCUS_RING_CLASS, useFocusTrap } from '../../../hooks/inboxA11y';
import type { PanelTab } from './types';

type PostPanelProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  /** Hide the composer tab for read-only remote (Already on Instagram) items. */
  showCreateTab: boolean;
  automationReady: boolean;
  body: ReactNode;
  footer?: ReactNode;
};

const TABS: Array<{ id: PanelTab; label: string; shortLabel: string; icon: typeof Pencil }> = [
  { id: 'create', label: 'Create Post', shortLabel: 'Create', icon: Pencil },
  { id: 'preview', label: 'Post Preview', shortLabel: 'Preview', icon: Eye },
  { id: 'automation', label: 'Comment Automation', shortLabel: 'Comment automation', icon: MessageSquare },
];

/**
 * Right-side composer/detail panel.
 * Wide desktop: sticky column beside the grid. Compact desktop/tablet (<1280px):
 * overlays the posts workspace only (sidebar and topbar stay reachable).
 * Escape-to-close and focus returned to the trigger.
 */
export default function PostPanel({
  open,
  onClose,
  title,
  tab,
  onTabChange,
  showCreateTab,
  automationReady,
  body,
  footer,
}: PostPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useFocusTrap({ ref: panelRef, active: open, onEscape: () => onCloseRef.current() });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);

    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const firstField = panel.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([type="hidden"]), textarea, select, a[href]',
      );
      (firstField ?? panel).focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const visibleTabs = TABS.filter((row) => row.id !== 'create' || showCreateTab);

  return (
    <aside
      ref={panelRef}
      className="igp-panel"
      role="dialog"
      aria-label={title}
      tabIndex={-1}
    >
      <header className="igp-panel__head">
        <button
          type="button"
          className={`igp-panel__close ${FOCUS_RING_CLASS}`}
          onClick={onClose}
          aria-label="Back to posts list"
        >
          <X strokeWidth={2.25} aria-hidden />
        </button>
        <div className="igp-panel__tabs" role="tablist" aria-label="Post panel sections">
          {visibleTabs.map((row) => {
            const Icon = row.icon;
            const active = tab === row.id;
            return (
              <button
                key={row.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={row.label}
                title={row.label}
                className={`igp-tab ${active ? 'igp-tab--on' : ''}`}
                onClick={() => onTabChange(row.id)}
              >
                <Icon className="igp-tab__icon" strokeWidth={2.2} aria-hidden />
                <span className="igp-tab__text">{row.shortLabel}</span>
                {row.id === 'automation' && active && automationReady ? (
                  <span className="igp-tab__dot" aria-label="Configured" />
                ) : null}
              </button>
            );
          })}
        </div>
      </header>

      <div className="igp-panel__body">{body}</div>
      {footer ? <footer className="igp-panel__foot">{footer}</footer> : null}
      <button
        type="button"
        className={`igp-panel__done ${FOCUS_RING_CLASS}`}
        onClick={onClose}
      >
        Back to posts
      </button>
    </aside>
  );
}
