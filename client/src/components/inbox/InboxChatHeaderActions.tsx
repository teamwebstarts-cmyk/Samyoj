import { Bot, Clock, LifeBuoy, MoreVertical, Phone, StickyNote, Tag } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import AppSelect from '../ui/AppSelect';
import type { AiBot, Conversation } from '../../types';

interface InboxChatHeaderActionsProps {
  selected: Conversation;
  botIsLive: boolean;
  botToggling: boolean;
  callingBack: boolean;
  aiBots: AiBot[];
  botSelectOptions: Array<{ value: string; label: string }>;
  labelsCount: number;
  onToggleBot: () => void;
  onChangeActiveBot: (botId: string) => void;
  onCallBack: () => void;
  onOpenLabels: () => void;
  onOpenNotes: () => void;
  onSnooze?: (hours: number) => void;
  onConvertToTicket?: () => void;
}

export default function InboxChatHeaderActions({
  selected,
  botIsLive,
  botToggling,
  callingBack,
  aiBots,
  botSelectOptions,
  labelsCount,
  onToggleBot,
  onChangeActiveBot,
  onCallBack,
  onOpenLabels,
  onOpenNotes,
  onSnooze,
  onConvertToTicket,
}: InboxChatHeaderActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  return (
    <>
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <button
          type="button"
          disabled={botToggling}
          onClick={onToggleBot}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-micro uppercase tracking-wide ring-1 transition ${
            botIsLive
              ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/80 hover:bg-emerald-100'
              : 'bg-neutral-100 text-neutral-600 ring-neutral-200/80 hover:bg-neutral-200/60'
          } ${botToggling ? 'opacity-60' : ''}`}
        >
          <Bot className="h-3.5 w-3.5" />
          {botToggling ? '...' : botIsLive ? 'AI ON' : 'AI OFF'}
        </button>

        {aiBots.length > 0 && (
          <AppSelect
            className="w-[148px] shrink-0"
            size="compact"
            value={selected.activeBot?.id || ''}
            options={botSelectOptions}
            placeholder="Default bot"
            isSearchable={false}
            disabled={botToggling}
            ariaLabel="Active AI bot for this chat"
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChangeActiveBot(e.target.value)}
          />
        )}

        <button
          type="button"
          disabled={callingBack}
          onClick={onCallBack}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-200/80 bg-violet-50 px-3 py-2 text-micro font-bold text-violet-800 transition hover:bg-violet-100 disabled:opacity-60"
        >
          <Phone className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{callingBack ? 'Calling...' : 'Call'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenLabels}
          title="Labels"
          className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-200/80 bg-violet-50 text-violet-700 transition hover:bg-violet-100 lg:hidden"
        >
          <Tag className="h-4 w-4" />
          {labelsCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-micro text-white">
              {labelsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenNotes}
          title="Team notes"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-200/80 bg-amber-50 text-amber-700 transition hover:bg-amber-100 lg:hidden"
        >
          <StickyNote className="h-4 w-4" />
        </button>

        {onConvertToTicket && (
          <button
            type="button"
            onClick={onConvertToTicket}
            title="Convert to ticket"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-sky-200/80 bg-sky-50 px-3 py-2 text-micro font-bold text-sky-800 transition hover:bg-sky-100 lg:hidden"
          >
            <LifeBuoy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ticket</span>
          </button>
        )}

        {onSnooze && (
          <button
            type="button"
            onClick={() => onSnooze(2)}
            title="Snooze 2 hours"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-200/80 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100 lg:hidden"
          >
            <Clock className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="relative md:hidden" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-theme-border bg-theme-surface text-theme-secondary"
          aria-label="More chat actions"
          aria-expanded={menuOpen}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[200px] overflow-hidden rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-label text-theme-fg hover:bg-theme-subtle"
              onClick={() => {
                onToggleBot();
                setMenuOpen(false);
              }}
            >
              <Bot className="h-4 w-4" />
              {botIsLive ? 'Pause AI bot' : 'Enable AI bot'}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-label text-theme-fg hover:bg-theme-subtle"
              onClick={() => {
                onCallBack();
                setMenuOpen(false);
              }}
            >
              <Phone className="h-4 w-4" />
              Call contact
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-label text-theme-fg hover:bg-theme-subtle"
              onClick={() => {
                onOpenLabels();
                setMenuOpen(false);
              }}
            >
              <Tag className="h-4 w-4" />
              Labels{labelsCount > 0 ? ` (${labelsCount})` : ''}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-label text-theme-fg hover:bg-theme-subtle"
              onClick={() => {
                onOpenNotes();
                setMenuOpen(false);
              }}
            >
              <StickyNote className="h-4 w-4" />
              Team notes
            </button>
            {onConvertToTicket && (
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-label text-theme-fg hover:bg-theme-subtle"
                onClick={() => {
                  onConvertToTicket();
                  setMenuOpen(false);
                }}
              >
                <LifeBuoy className="h-4 w-4" />
                Convert to ticket
              </button>
            )}
            {onSnooze && (
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-label text-theme-fg hover:bg-theme-subtle"
                onClick={() => {
                  onSnooze(2);
                  setMenuOpen(false);
                }}
              >
                <Clock className="h-4 w-4" />
                Snooze 2 hours
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
