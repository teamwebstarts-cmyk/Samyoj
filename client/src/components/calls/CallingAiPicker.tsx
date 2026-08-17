import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Bot, CheckCircle2, ChevronDown, Loader2, User } from 'lucide-react';
import { FOCUS_RING_CLASS, useFocusTrap } from '../../hooks/inboxA11y';
import { computeFixedPopoverPosition, type PopoverCoords } from '../inbox/inboxPopoverPosition';
import { useGlassTipProps } from '../inbox/ComposerGlassTip';

export interface CallingAiPickerProps {
  enabled: boolean;
  saving?: boolean;
  /** Calling bot name for this person when AI is on — display only. */
  botName?: string | null;
  onChange: (enabled: boolean) => void;
}

const PANEL_WIDTH = 280;

const GLASS_PANEL =
  'overflow-hidden rounded-xl border border-theme-border bg-white/90 shadow-lg backdrop-blur-md focus:outline-none dark:bg-neutral-900/90';

function CallingAiMenu({
  enabled,
  saving,
  botName,
  anchorRef,
  onChange,
  onClose,
}: {
  enabled: boolean;
  saving?: boolean;
  botName?: string | null;
  anchorRef: RefObject<HTMLElement | null>;
  onChange: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);

  useFocusTrap({ ref: containerRef, active: true, onEscape: onClose });

  useLayoutEffect(() => {
    if (!anchorRef.current) {
      setCoords(null);
      return;
    }

    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const height = containerRef.current?.offsetHeight ?? 220;
      setCoords(
        computeFixedPopoverPosition(
          anchor.getBoundingClientRect(),
          { width: PANEL_WIDTH, height },
          { prefer: 'below' }
        )
      );
    };

    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef, enabled, saving]);

  useLayoutEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [anchorRef, onClose]);

  const pick = (next: boolean) => {
    if (saving) return;
    if (next === enabled) {
      onClose();
      return;
    }
    onChange(next);
    onClose();
  };

  const onLabel = botName?.trim() || 'AI answers';

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Calling AI for this person"
      tabIndex={-1}
      style={
        coords
          ? { top: coords.top, left: coords.left, width: PANEL_WIDTH }
          : undefined
      }
      className={`inbox-modal-enter motion-reduce:animate-none fixed z-[80] ${GLASS_PANEL} ${
        coords ? 'visible' : 'invisible'
      }`}
    >
      <div className="border-b border-theme-border/60 px-3 py-2.5">
        <p className="text-[12px] font-semibold text-theme-fg">Calling AI</p>
        <p className="text-[10px] text-theme-muted">
          {enabled
            ? 'AI answers this person on their next call'
            : 'Person only — humans pick up, then miss if nobody is free'}
        </p>
      </div>

      <div className="py-0.5" role="listbox" aria-label="Calling AI for this person">
        <button
          type="button"
          role="option"
          aria-selected={enabled}
          disabled={saving}
          onClick={() => pick(true)}
          className={`flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-theme-subtle disabled:opacity-50 ${FOCUS_RING_CLASS} ${
            enabled ? 'bg-whatsapp-500/8' : ''
          }`}
        >
          <Bot
            className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
              enabled ? 'text-whatsapp-600' : 'text-theme-muted'
            }`}
            strokeWidth={2.1}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold tracking-tight text-theme-fg">
              {onLabel}
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-theme-muted">
              AI answers this person
            </span>
          </span>
          {enabled && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-whatsapp-600" />}
        </button>

        <button
          type="button"
          role="option"
          aria-selected={!enabled}
          disabled={saving}
          onClick={() => pick(false)}
          className={`flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-theme-subtle disabled:opacity-50 ${FOCUS_RING_CLASS} ${
            !enabled ? 'bg-whatsapp-500/8' : ''
          }`}
        >
          <User
            className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
              !enabled ? 'text-whatsapp-600' : 'text-theme-muted'
            }`}
            strokeWidth={2.1}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold tracking-tight text-theme-fg">
              Off
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-theme-muted">
              Person only — human, then miss
            </span>
          </span>
          {!enabled && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-whatsapp-600" />}
        </button>
      </div>
    </div>,
    document.body
  );
}

/** Inbox-style header control: on/off for per-contact calling AI (SAMYOJ-69). */
export default function CallingAiPicker({
  enabled,
  saving,
  botName,
  onChange,
}: CallingAiPickerProps) {
  const tipFor = useGlassTipProps();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const label = enabled ? botName?.trim() || 'AI' : 'Off';
  const tip = enabled
    ? `AI answers this person${botName?.trim() ? ` · ${botName.trim()}` : ''}`
    : 'Off · Person only — humans pick up, then miss';

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        aria-label={`${enabled ? 'AI answers' : 'Calling AI off'} · ${label}. Open calling AI menu`}
        aria-expanded={open}
        aria-haspopup="dialog"
        {...tipFor(tip)}
        className={`relative flex h-8 max-w-[11.5rem] shrink-0 items-center gap-1.5 rounded-[10px] border px-2 transition disabled:cursor-not-allowed disabled:opacity-45 md:h-9 ${FOCUS_RING_CLASS} ${
          open
            ? 'border-whatsapp-500/50 bg-whatsapp-500/10 text-whatsapp-700 dark:text-whatsapp-400'
            : enabled
              ? 'border-whatsapp-500/40 bg-whatsapp-500/8 text-whatsapp-700 hover:bg-whatsapp-500/12 dark:text-whatsapp-400'
              : 'border-theme-border bg-theme-surface text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg'
        } max-md:h-8 max-md:w-8 max-md:justify-center max-md:px-0`}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full max-md:absolute max-md:bottom-1 max-md:right-1 ${
            enabled ? 'bg-whatsapp-500' : 'bg-neutral-300 dark:bg-neutral-600'
          }`}
          aria-hidden
        />
        <Bot className="h-4 w-4 shrink-0" strokeWidth={2.1} />
        <span className="hidden min-w-0 flex-1 truncate text-left text-[12px] font-semibold tracking-tight md:block">
          {label}
        </span>
        {saving ? (
          <Loader2 className="hidden h-3.5 w-3.5 shrink-0 animate-spin opacity-70 md:block" strokeWidth={2.25} />
        ) : (
          <ChevronDown
            className={`hidden h-3.5 w-3.5 shrink-0 opacity-70 transition md:block ${open ? 'rotate-180' : ''}`}
            strokeWidth={2.25}
          />
        )}
      </button>
      {open && (
        <CallingAiMenu
          enabled={enabled}
          saving={saving}
          botName={botName}
          anchorRef={btnRef}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
