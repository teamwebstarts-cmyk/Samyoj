import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Bot, CheckCircle2, ExternalLink } from 'lucide-react';
import type { AiBot } from '../../types';
import { FOCUS_RING_CLASS, useFocusTrap } from '../../hooks/inboxA11y';
import { computeFixedPopoverPosition, type PopoverCoords } from './inboxPopoverPosition';
import { useAuth } from '../../contexts/AuthContext';

export interface BotPickerPopoverProps {
  bots: AiBot[];
  loading?: boolean;
  /** Conversation's assigned bot id; null = org default (Auto). */
  activeBotId: string | null;
  botIsLive: boolean;
  botToggling?: boolean;
  botAssigning?: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onToggleBot: () => void;
  onSelectBot: (botId: string | null) => void;
  onClose: () => void;
}

const PANEL_WIDTH = 280;

const GLASS_PANEL =
  'overflow-hidden rounded-xl border border-theme-border bg-white/90 shadow-lg backdrop-blur-md focus:outline-none dark:bg-neutral-900/90';

function truncateHint(text?: string | null, max = 72): string | null {
  const t = text?.trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Header popover: toggle AI replies and choose which bot handles this chat. */
export default function BotPickerPopover({
  bots,
  loading = false,
  activeBotId,
  botIsLive,
  botToggling = false,
  botAssigning = false,
  anchorRef,
  onToggleBot,
  onSelectBot,
  onClose,
}: BotPickerPopoverProps) {
  const { canManageTeam } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);

  useFocusTrap({ ref: containerRef, active: true, onEscape: onClose });

  const enabledBots = useMemo(() => bots.filter((b) => b.enabled), [bots]);
  const defaultBot = useMemo(
    () => enabledBots.find((b) => b.isDefault) ?? enabledBots[0] ?? null,
    [enabledBots]
  );

  useLayoutEffect(() => {
    if (!anchorRef.current) {
      setCoords(null);
      return;
    }

    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const height = containerRef.current?.offsetHeight ?? 320;
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
  }, [anchorRef, enabledBots.length, loading, botIsLive, botToggling]);

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

  const pick = (botId: string | null) => {
    if (botAssigning) return;
    onSelectBot(botId);
    onClose();
  };

  const busy = botAssigning || loading;
  const toggleBusy = botToggling || botAssigning;

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose chatbot for this chat"
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
            <p className="text-[12px] font-semibold text-theme-fg">Automations</p>
            <p className="text-[10px] text-theme-muted">
              {botIsLive
                ? 'Journeys, auto-replies, and AI are on for this chat'
                : 'Paused — journeys, auto-replies, and AI will not send'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={botIsLive}
            aria-label={botIsLive ? 'Pause automations' : 'Enable automations'}
            disabled={toggleBusy}
            onClick={onToggleBot}
            className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS} ${
              botIsLive ? 'bg-whatsapp-500' : 'bg-neutral-300 dark:bg-neutral-600'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                botIsLive ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="px-3 pb-1 pt-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">
          Bot for this chat
        </p>
      </div>

      <div className="max-h-56 overflow-y-auto py-0.5" role="listbox" aria-label="Select chatbot">
        {loading ? (
          <p className="px-3 py-3 text-[12px] text-theme-muted">Loading bots…</p>
        ) : (
          <>
            <button
              type="button"
              role="option"
              aria-selected={activeBotId === null}
              disabled={busy}
              onClick={() => pick(null)}
              className={`flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-theme-subtle disabled:opacity-50 ${FOCUS_RING_CLASS} ${
                activeBotId === null ? 'bg-whatsapp-500/8' : ''
              }`}
            >
              <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-theme-muted" strokeWidth={2.1} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold tracking-tight text-theme-fg">
                  Auto · default
                </span>
                <span className="block text-[11px] leading-snug text-theme-muted">
                  {defaultBot ? `Uses ${defaultBot.name}` : 'Org default chatbot'}
                </span>
              </span>
              {activeBotId === null && (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-whatsapp-600" />
              )}
            </button>

            {enabledBots.map((bot) => {
              const selected = activeBotId === bot.id;
              const hint =
                truncateHint(bot.instructions) ||
                (bot._count?.knowledgeItems != null
                  ? `${bot._count.knowledgeItems} FAQ`
                  : null);
              return (
                <button
                  key={bot.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={busy}
                  onClick={() => pick(bot.id)}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-theme-subtle disabled:opacity-50 ${FOCUS_RING_CLASS} ${
                    selected ? 'bg-whatsapp-500/8' : ''
                  }`}
                >
                  <Bot
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      selected ? 'text-whatsapp-600' : 'text-theme-muted'
                    }`}
                    strokeWidth={2.1}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[13px] font-semibold tracking-tight text-theme-fg">
                        {bot.name}
                      </span>
                      {bot.isDefault ? (
                        <span className="shrink-0 rounded bg-theme-subtle px-1 py-px text-[9px] font-bold uppercase tracking-wide text-theme-muted">
                          Default
                        </span>
                      ) : null}
                    </span>
                    {hint ? (
                      <span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug text-theme-muted">
                        {hint}
                      </span>
                    ) : null}
                  </span>
                  {selected && (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-whatsapp-600" />
                  )}
                </button>
              );
            })}

            {enabledBots.length === 0 && (
              <p className="px-3 py-3 text-[12px] text-theme-muted">
                No enabled bots. Create one in AI Bots.
              </p>
            )}

            {activeBotId && !enabledBots.some((b) => b.id === activeBotId) && (
              <p className="px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
                Assigned bot is unavailable — pick another or Auto.
              </p>
            )}
          </>
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
