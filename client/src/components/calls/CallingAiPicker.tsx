import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Bot, CheckCircle2, ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import { FOCUS_RING_CLASS, useFocusTrap } from '../../hooks/inboxA11y';
import { computeFixedPopoverPosition, type PopoverCoords } from '../inbox/inboxPopoverPosition';
import { useGlassTipProps } from '../inbox/ComposerGlassTip';
import { useAuth } from '../../contexts/AuthContext';
import { aiBotApi } from '../../services/api';
import type { AiBot } from '../../types';

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
  displayName,
  showDefault,
  loading,
  anchorRef,
  onToggle,
  onClose,
}: {
  enabled: boolean;
  saving?: boolean;
  displayName: string;
  showDefault: boolean;
  loading: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { canManageTeam } = useAuth();
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
  }, [anchorRef, enabled, saving, loading, displayName]);

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
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-theme-fg">Calling AI</p>
            <p className="text-[10px] text-theme-muted">{enabled ? 'On for this person' : 'Paused'}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? 'Pause calling AI' : 'Enable calling AI'}
            disabled={saving}
            onClick={onToggle}
            className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS} ${
              enabled ? 'bg-whatsapp-500' : 'bg-neutral-300 dark:bg-neutral-600'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                enabled ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="px-3 pb-1 pt-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">
          Bot for this person
        </p>
      </div>

      <div className="py-0.5" role="listbox" aria-label="Calling bot">
        {loading ? (
          <p className="px-3 py-3 text-[12px] text-theme-muted">Loading bots…</p>
        ) : (
          <button
            type="button"
            role="option"
            aria-selected
            disabled={saving}
            onClick={onClose}
            className={`flex w-full items-center gap-2 bg-whatsapp-500/8 px-3 py-2 text-left transition hover:bg-theme-subtle disabled:opacity-50 ${FOCUS_RING_CLASS}`}
          >
            <Bot className="h-3.5 w-3.5 shrink-0 text-whatsapp-600" strokeWidth={2.1} />
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold tracking-tight text-theme-fg">
                {displayName}
              </span>
              {showDefault ? (
                <span className="shrink-0 rounded bg-theme-subtle px-1 py-px text-[9px] font-bold uppercase tracking-wide text-theme-muted">
                  Default
                </span>
              ) : null}
            </span>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-whatsapp-600" />
          </button>
        )}
      </div>

      <Link
        to="/ai-bot"
        onClick={onClose}
        className="flex w-full items-center gap-1.5 border-t border-theme-border/60 px-3 py-2.5 text-[12px] font-semibold text-slate-500 transition hover:bg-theme-subtle hover:text-whatsapp-700 dark:text-slate-400 dark:hover:text-whatsapp-400"
      >
        {canManageTeam ? 'Train & manage in AI Bots' : 'View AI Bots'}
        <ExternalLink className="h-3 w-3" strokeWidth={2.25} aria-hidden />
      </Link>
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
  const [callBots, setCallBots] = useState<AiBot[]>([]);
  const [answeringCallBotId, setAnsweringCallBotId] = useState<string | null>(null);
  const [botsLoading, setBotsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    aiBotApi
      .list('CALL')
      .then(({ data }) => {
        if (cancelled) return;
        setCallBots((data.data?.bots ?? []) as AiBot[]);
        setAnsweringCallBotId(
          typeof data.data?.answeringCallBotId === 'string' ? data.data.answeringCallBotId : null
        );
      })
      .catch(() => {
        if (!cancelled) setCallBots([]);
      })
      .finally(() => {
        if (!cancelled) setBotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayBot = useMemo(() => {
    const enabledBots = callBots.filter((b) => b.enabled && (b.channel ?? 'CALL') === 'CALL');
    const trimmed = botName?.trim();
    return (
      enabledBots.find((b) => b.id === answeringCallBotId) ??
      enabledBots.find((b) => b.answersCalls) ??
      (trimmed ? enabledBots.find((b) => b.name === trimmed) : undefined) ??
      enabledBots[0] ??
      null
    );
  }, [callBots, answeringCallBotId, botName]);

  const displayName = displayBot?.name || botName?.trim() || 'AI';
  const showDefault = Boolean(
    displayBot &&
      (displayBot.id === answeringCallBotId ||
        displayBot.answersCalls ||
        displayBot.isDefault ||
        callBots.filter((b) => b.enabled && (b.channel ?? 'CALL') === 'CALL').length === 1)
  );

  const tip = enabled ? `On · ${displayName}` : `Paused · ${displayName}`;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        aria-label={`${enabled ? 'Calling AI on' : 'Calling AI off'} · ${displayName}. Open calling AI menu`}
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
          {displayName}
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
          displayName={displayName}
          showDefault={showDefault}
          loading={botsLoading}
          anchorRef={btnRef}
          onToggle={() => {
            if (saving) return;
            onChange(!enabled);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
