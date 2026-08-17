import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Bot, Send } from 'lucide-react';
import { supportApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { toastError } from '../../utils/toast';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import type { SupportChatMessage } from './types';
import { toApiChatMessages } from './transcript';

interface SupportAssistantTabProps {
  messages: SupportChatMessage[];
  onMessagesChange: (messages: SupportChatMessage[]) => void;
  userInitials: string;
  assistantOnline: boolean;
  onEscalate: () => void;
  escalating: boolean;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function SupportAssistantTab({
  messages,
  onMessagesChange,
  userInitials,
  assistantOnline,
  onEscalate,
  escalating,
}: SupportAssistantTabProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canEscalate = messages.some((m) => m.role === 'user');

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const userMsg: SupportChatMessage = { id: newId(), role: 'user', content: text };
    const next = [...messages, userMsg];
    onMessagesChange(next);
    setDraft('');
    setSending(true);
    try {
      const res = await supportApi.chat(toApiChatMessages(next));
      const reply = (res.data?.data?.reply as string | undefined)?.trim();
      if (!reply) throw new Error('empty');
      onMessagesChange([...next, { id: newId(), role: 'assistant', content: reply }]);
    } catch (err) {
      toastError(getErrorMessage(err, 'Could not reach the assistant. Try again or open a ticket.'));
      onMessagesChange(next);
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[#F4F7F6] px-4 py-4 dark:bg-theme-subtle"
      >
        {messages.map((msg) =>
          msg.role === 'user' ? (
            <div key={msg.id} className="flex justify-end gap-2">
              <div className="max-w-[85%] text-right">
                <p className="mb-1 pr-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-neutral-400">
                  You
                </p>
                <div className="rounded-2xl rounded-br-md bg-[#087F5B] px-3.5 py-2.5 text-left text-[13.5px] font-medium leading-relaxed text-white shadow-[0_1px_2px_rgba(8,127,91,0.25)]">
                  {msg.content}
                </div>
              </div>
              <span
                className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[11px] font-extrabold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-100"
                aria-hidden
              >
                {userInitials}
              </span>
            </div>
          ) : (
            <div key={msg.id} className="flex items-start gap-2">
              <span
                className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#087F5B] ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60"
                aria-hidden
              >
                <Bot className="h-4 w-4" strokeWidth={2.1} />
              </span>
              <div className="max-w-[85%]">
                <p className="mb-1 pl-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-neutral-400">
                  Support AI
                </p>
                <div className="rounded-2xl rounded-bl-md border border-neutral-200/80 bg-white px-3.5 py-2.5 text-[13.5px] font-medium leading-relaxed text-neutral-800 shadow-sm dark:border-theme-border dark:bg-theme-surface dark:text-theme-fg">
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            </div>
          )
        )}
        {sending && (
          <div className="flex items-start gap-2">
            <span className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#087F5B] ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Bot className="h-4 w-4" strokeWidth={2.1} />
            </span>
            <div>
              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-neutral-400">
                Support AI
              </p>
              <div
                className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md border border-neutral-200/80 bg-white px-3.5 py-3 dark:border-theme-border dark:bg-theme-surface"
                aria-live="polite"
                aria-label="Assistant is typing"
              >
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.32s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.16s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-theme-border bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:bg-theme-surface">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onEscalate}
            disabled={!canEscalate || escalating || sending}
            className={`inline-flex h-9 items-center rounded-xl border border-theme-border bg-theme-surface px-3 text-[12.5px] font-bold text-theme-fg transition hover:bg-theme-subtle disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING_CLASS}`}
          >
            {escalating ? 'Opening ticket…' : 'Escalate to ticket'}
          </button>
          <p className="max-w-[14rem] text-right text-[11px] font-medium leading-snug text-theme-muted">
            Need human help? Open a ticket from this chat.
          </p>
        </div>

        <div className="relative">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            maxLength={2000}
            placeholder={assistantOnline ? 'Type your question...' : 'Assistant is offline — open a ticket instead'}
            disabled={sending || !assistantOnline}
            className="w-full resize-none rounded-2xl border border-theme-border bg-theme-subtle/50 py-3 pl-3.5 pr-12 text-[13.5px] font-medium text-theme-fg shadow-input placeholder:text-theme-muted focus:border-emerald-400 focus:outline-none focus:shadow-[0_0_0_4px_rgba(8,127,91,0.14)] disabled:opacity-60"
            aria-label="Type your question"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!draft.trim() || sending || !assistantOnline}
            className={`absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-[#087F5B] text-white shadow-[0_2px_8px_rgba(8,127,91,0.35)] transition hover:bg-[#066a4c] disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:shadow-none ${FOCUS_RING_CLASS}`}
            aria-label="Send"
          >
            <Send className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10.5px] font-semibold text-theme-muted">
          <span>
            <kbd className="rounded-md border border-theme-border bg-theme-subtle px-1.5 py-0.5 font-bold">
              Enter
            </kbd>{' '}
            to send
          </span>
          <span>
            <kbd className="rounded-md border border-theme-border bg-theme-subtle px-1.5 py-0.5 font-bold">
              Shift
            </kbd>{' '}
            +{' '}
            <kbd className="rounded-md border border-theme-border bg-theme-subtle px-1.5 py-0.5 font-bold">
              Enter
            </kbd>{' '}
            for new line
          </span>
        </div>
      </div>
    </div>
  );
}
