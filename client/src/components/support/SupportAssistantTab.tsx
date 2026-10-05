import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Bot, Send } from 'lucide-react';
import { supportApi } from '../../services/api';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import type { SupportChatMessage } from './types';
import { toApiChatMessages } from './transcript';
import { supportChatErrorMessage } from './errors';
import { followUpPromptsFor } from './prompts';
import SupportWelcome from './SupportWelcome';
import SupportAnswer from './SupportAnswer';

interface SupportAssistantTabProps {
  messages: SupportChatMessage[];
  onMessagesChange: (messages: SupportChatMessage[]) => void;
  userInitials: string;
  assistantOnline: boolean | null;
  onAssistantReply?: () => void;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function lastAssistantText(messages: SupportChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'assistant') return messages[i].content;
  }
  return '';
}

function lastUserText(messages: SupportChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return messages[i].content;
  }
  return '';
}

export default function SupportAssistantTab({
  messages,
  onMessagesChange,
  userInitials,
  assistantOnline,
  onAssistantReply,
}: SupportAssistantTabProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerLocked = sending || assistantOnline === false;
  const welcomeOnly = !messages.some((m) => m.role === 'user');
  const visibleMessages = messages.filter((m) => m.id !== 'welcome');
  const followUps =
    !welcomeOnly && !sending && !sendError
      ? followUpPromptsFor(
          lastUserText(messages),
          lastAssistantText(messages),
          4,
          messages.filter((m) => m.role === 'user').map((m) => m.content)
        )
      : [];

  const followUpButtons =
    followUps.length > 0 ? (
      <div className="rounded-xl border border-sky-100/80 bg-sky-50/50 px-3 py-2.5 dark:border-sky-900/40 dark:bg-sky-950/20">
        <p className="mb-1.5 text-[11px] font-bold text-sky-800 dark:text-sky-200">Suggested for you</p>
        <div className="flex flex-col gap-1.5">
          {followUps.map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              disabled={composerLocked}
              onClick={() => void sendText(prompt.question)}
              className={`rounded-lg border border-theme-border/80 bg-theme-surface px-3 py-2 text-left text-[12px] font-semibold leading-snug text-theme-secondary transition hover:border-sky-300 hover:bg-white hover:text-theme-fg disabled:cursor-not-allowed disabled:opacity-45 dark:hover:border-sky-600/40 dark:hover:bg-theme-surface ${FOCUS_RING_CLASS}`}
            >
              {prompt.label}
            </button>
          ))}
        </div>
      </div>
    ) : null;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending, sendError, welcomeOnly, followUps.length]);

  useEffect(() => {
    if (assistantOnline === false || welcomeOnly) return;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [assistantOnline, welcomeOnly]);

  const requestReply = async (history: SupportChatMessage[]) => {
    setSending(true);
    setSendError(null);
    try {
      const res = await supportApi.chat(toApiChatMessages(history));
      const reply = (res.data?.data?.reply as string | undefined)?.trim();
      if (!reply) {
        setSendError('The assistant could not reply. Try again.');
        return;
      }
      onMessagesChange([...history, { id: newId(), role: 'assistant', content: reply }]);
      onAssistantReply?.();
    } catch (err) {
      setSendError(supportChatErrorMessage(err));
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || assistantOnline === false) return;
    const userMsg: SupportChatMessage = { id: newId(), role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setSending(true);
    onMessagesChange(next);
    setDraft('');
    await requestReply(next);
  };

  const send = async () => {
    await sendText(draft);
  };

  const retry = async () => {
    if (sending || assistantOnline === false) return;
    const payload = toApiChatMessages(messages);
    if (payload.length === 0) return;
    await requestReply(messages);
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
        className="inbox-chat-bg min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4"
      >
        {welcomeOnly ? (
          <div className="flex min-h-full flex-col justify-center py-6">
            <SupportWelcome disabled={composerLocked} onAsk={(q) => void sendText(q)} />
          </div>
        ) : (
          visibleMessages.map((msg) =>
            msg.role === 'user' ? (
              <div key={msg.id} className="flex justify-end gap-2">
                <div className="max-w-[85%] text-right">
                  <p className="mb-1 pr-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-theme-muted">
                    You
                  </p>
                  <div className="rounded-2xl rounded-br-md bg-sky-600 px-3.5 py-2.5 text-left text-[13.5px] font-medium leading-relaxed text-white shadow-[0_1px_2px_rgba(2,132,199,0.25)]">
                    {msg.content}
                  </div>
                </div>
                <span
                  className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-theme-border text-[11px] font-extrabold text-theme-fg"
                  aria-hidden
                >
                  {userInitials}
                </span>
              </div>
            ) : (
              <div key={msg.id} className="flex items-start gap-2">
                <span
                  className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/60"
                  aria-hidden
                >
                  <Bot className="h-4 w-4" strokeWidth={2.1} />
                </span>
                <div className="max-w-[85%]">
                  <p className="mb-1 pl-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-theme-muted">
                    Support AI
                  </p>
                  <div className="rounded-2xl rounded-bl-md border border-theme-border bg-theme-surface px-3.5 py-2.5 text-theme-fg shadow-sm">
                    <SupportAnswer content={msg.content} />
                  </div>
                </div>
              </div>
            )
          )
        )}
        {sending && (
          <div className="flex items-start gap-2">
            <span className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300">
              <Bot className="h-4 w-4" strokeWidth={2.1} />
            </span>
            <div className="min-w-0 max-w-[85%] flex-1">
              <p className="mb-1 pl-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-theme-muted">
                Support AI
              </p>
              <div
                className="support-thinking-bubble flex min-h-[3.25rem] w-full items-center gap-3 rounded-2xl rounded-bl-md border border-sky-200/80 bg-theme-surface px-4 py-3.5 shadow-sm dark:border-sky-900/50"
                aria-live="polite"
                aria-label="Assistant is thinking"
              >
                <span className="support-thinking-orb relative flex h-9 w-9 shrink-0 items-center justify-center">
                  <span className="support-thinking-ring absolute inset-0 rounded-full" aria-hidden />
                  <span className="relative z-[1] flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300">
                    <Bot className="h-4 w-4" strokeWidth={2.2} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-bold text-sky-800 dark:text-sky-200">
                    Thinking…
                  </span>
                  <span className="support-thinking-bars mt-1.5 flex flex-col gap-1.5" aria-hidden>
                    <span className="support-thinking-bar h-1.5 w-[88%] rounded-full" />
                    <span className="support-thinking-bar support-thinking-bar--late h-1.5 w-[62%] rounded-full" />
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}

        {!welcomeOnly && !sending && followUpButtons}
      </div>

      <div className="shrink-0 border-t border-theme-border bg-theme-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        {assistantOnline === false && (
          <div className="mb-2.5 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="text-[12.5px] font-semibold leading-snug text-amber-950 dark:text-amber-100">
              Assistant is unavailable. Try again in a moment.
            </p>
          </div>
        )}

        {sendError && (
          <div
            className="mb-2.5 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2.5 dark:border-rose-900/50 dark:bg-rose-950/30"
            role="alert"
          >
            <p className="text-[12.5px] font-semibold leading-snug text-rose-900 dark:text-rose-100">{sendError}</p>
            <button
              type="button"
              onClick={() => void retry()}
              disabled={sending || assistantOnline === false}
              className={`mt-2 inline-flex h-8 items-center rounded-lg border border-theme-border bg-theme-surface px-3 text-[12px] font-bold text-theme-fg ${FOCUS_RING_CLASS}`}
            >
              Try again
            </button>
          </div>
        )}

        <div className="relative">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            maxLength={2000}
            placeholder={
              assistantOnline === false ? 'Assistant is unavailable' : 'Type your question...'
            }
            disabled={composerLocked}
            className="w-full resize-none rounded-2xl border border-theme-border bg-theme-subtle/50 py-3 pl-3.5 pr-12 text-[13.5px] font-medium text-theme-fg shadow-input placeholder:text-theme-muted focus:border-sky-400 focus:outline-none focus:shadow-[0_0_0_4px_rgba(14,165,233,0.14)] disabled:opacity-60"
            aria-label="Type your question"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!draft.trim() || composerLocked}
            className={`absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 text-white shadow-[0_2px_8px_rgba(14,165,233,0.35)] transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:shadow-none ${FOCUS_RING_CLASS}`}
            aria-label="Send"
          >
            <Send className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}
