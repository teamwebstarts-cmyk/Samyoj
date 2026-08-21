import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Bot, CheckCircle2, ChevronDown, Loader2 } from 'lucide-react';
import { FOCUS_RING_CLASS, useFocusTrap } from '../../hooks/inboxA11y';
import { computeFixedPopoverPosition, type PopoverCoords } from '../inbox/inboxPopoverPosition';
import { useGlassTipProps } from '../inbox/ComposerGlassTip';
import type { AiBot } from '../../types';

export interface ChatAiPickerProps {
  enabled: boolean;
  saving?: boolean;
  /** Fallback label when bot list is loading. */
  botName?: string | null;
  onChange: (enabled: boolean) => void;
  /** Org-wide default chat bot id. */
  defaultChatBotId?: string | null;
  chatBots?: AiBot[];
  botsLoading?: boolean;
  botAssigning?: boolean;
  onSelectBot?: (botId: string) => void;
  /** Hide per-person toggle — use when org toggle lives outside (Inbox banner). */
  orgMode?: boolean;
}

const PANEL_WIDTH = 280;
/** ~4 list rows visible, then scroll */
const LIST_MAX_HEIGHT = 'max-h-[9.5rem]';

const GLASS_PANEL =
  'overflow-hidden rounded-xl border border-theme-border bg-white/90 shadow-lg backdrop-blur-md focus:outline-none dark:bg-neutral-900/90';

function ChatAiMenu({
  enabled,
  saving,
  orgMode,
  enabledBots,
  selectedBotId,
  loading,
  assigning,
  anchorRef,
  onToggle,
  onSelectBot,
  onClose,
}: {
  enabled: boolean;
  saving?: boolean;
  orgMode?: boolean;
  enabledBots: AiBot[];
  selectedBotId: string | null;
  loading: boolean;
  assigning?: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onToggle: () => void;
  onSelectBot: (botId: string) => void;
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
      const height = containerRef.current?.offsetHeight ?? 260;
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
  }, [anchorRef, enabled, saving, loading, assigning, enabledBots.length, orgMode]);

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

  const busy = assigning || loading;

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={orgMode ? 'Choose chat agent' : 'Chat AI for this person'}
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
      {!orgMode ? (
        <div className="border-b border-theme-border/60 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-theme-fg">Chat AI</p>
              <p className="text-[10px] text-theme-muted">{enabled ? 'On for this person' : 'Paused'}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={enabled ? 'Pause chat AI' : 'Enable chat AI'}
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
      ) : null}

      <div className="px-3 pb-1 pt-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">
          {orgMode ? 'Agent for all chats' : 'Chat agent'}
        </p>
      </div>

      <div className={`${LIST_MAX_HEIGHT} overflow-y-auto py-0.5`} role="listbox" aria-label="Chat agents">
        {loading ? (
          <p className="px-3 py-3 text-[12px] text-theme-muted">Loading agents…</p>
        ) : enabledBots.length === 0 ? (
          <p className="px-3 py-3 text-[12px] text-theme-muted">No enabled chat agents.</p>
        ) : (
          enabledBots.map((bot) => {
            const selected = selectedBotId === bot.id;
            return (
              <button
                key={bot.id}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={busy || saving}
                onClick={() => {
                  if (selected) {
                    onClose();
                    return;
                  }
                  onSelectBot(bot.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-theme-subtle disabled:opacity-50 ${FOCUS_RING_CLASS} ${
                  selected ? 'bg-whatsapp-500/8' : ''
                }`}
              >
                <Bot
                  className={`h-3.5 w-3.5 shrink-0 ${
                    selected ? 'text-whatsapp-600' : 'text-theme-muted'
                  }`}
                  strokeWidth={2.1}
                />
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold tracking-tight text-theme-fg">
                    {bot.name}
                  </span>
                  {bot.isSystem ? (
                    <span className="shrink-0 rounded bg-theme-subtle px-1 py-px text-[9px] font-bold uppercase tracking-wide text-theme-muted">
                      Support
                    </span>
                  ) : null}
                </span>
                {selected ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-whatsapp-600" />
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body
  );
}

/** Inbox-style control: per-contact on/off + org chat agent picker. */
export default function ChatAiPicker({
  enabled,
  saving,
  botName,
  onChange,
  defaultChatBotId = null,
  chatBots = [],
  botsLoading = false,
  botAssigning = false,
  onSelectBot,
  orgMode = false,
}: ChatAiPickerProps) {
  const tipFor = useGlassTipProps();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const enabledBots = useMemo(
    () => chatBots.filter((b) => b.enabled && (b.channel ?? 'CHAT') === 'CHAT'),
    [chatBots]
  );

  const selectedBotId = useMemo(() => {
    return (
      defaultChatBotId ??
      enabledBots.find((b) => b.isDefault)?.id ??
      enabledBots[0]?.id ??
      null
    );
  }, [defaultChatBotId, enabledBots]);

  const displayBot = useMemo(
    () => enabledBots.find((b) => b.id === selectedBotId) ?? null,
    [enabledBots, selectedBotId]
  );

  const displayName = displayBot?.name || botName?.trim() || 'Pick agent';
  const tip = orgMode
    ? `${enabled ? 'On' : 'Off'} · ${displayName}`
    : enabled
      ? `On · ${displayName}`
      : `Paused · ${displayName}`;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving || botAssigning}
        aria-label={`${enabled ? 'Chat AI on' : 'Chat AI off'} · ${displayName}. Open chat agent menu`}
        aria-expanded={open}
        aria-haspopup="dialog"
        {...tipFor(tip)}
        className={`relative flex h-8 max-w-[11.5rem] shrink-0 items-center gap-1.5 rounded-[10px] border px-2 transition disabled:cursor-not-allowed disabled:opacity-45 md:h-9 ${FOCUS_RING_CLASS} ${
          open
            ? 'border-whatsapp-500/50 bg-whatsapp-500/10 text-whatsapp-700 dark:text-whatsapp-400'
            : enabled
              ? 'border-whatsapp-500/40 bg-whatsapp-500/8 text-whatsapp-700 hover:bg-whatsapp-500/12 dark:text-whatsapp-400'
              : 'border-theme-border bg-theme-surface text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            enabled ? 'bg-whatsapp-500' : 'bg-neutral-300 dark:bg-neutral-600'
          }`}
          aria-hidden
        />
        <Bot className="h-4 w-4 shrink-0" strokeWidth={2.1} />
        <span className="min-w-0 flex-1 truncate text-left text-[12px] font-semibold tracking-tight">
          {displayName}
        </span>
        {saving || botAssigning ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-70" strokeWidth={2.25} />
        ) : (
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 opacity-70 transition ${open ? 'rotate-180' : ''}`}
            strokeWidth={2.25}
          />
        )}
      </button>
      {open && (
        <ChatAiMenu
          enabled={enabled}
          saving={saving}
          orgMode={orgMode}
          enabledBots={enabledBots}
          selectedBotId={selectedBotId}
          loading={botsLoading}
          assigning={botAssigning}
          anchorRef={btnRef}
          onToggle={() => {
            if (saving) return;
            onChange(!enabled);
          }}
          onSelectBot={(botId) => onSelectBot?.(botId)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
