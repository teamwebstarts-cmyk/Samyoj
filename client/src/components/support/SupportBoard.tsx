import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Headphones, Info, Layers, MessageSquare, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { FOCUS_RING_CLASS, useFocusTrap } from '../../hooks/inboxA11y';
import { useModalTransition } from '../../hooks/useModalTransition';
import { supportApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { toastError, toastSuccess } from '../../utils/toast';
import SupportAssistantTab from './SupportAssistantTab';
import SupportTicketsTab from './SupportTicketsTab';
import { nameInitials, toApiChatMessages } from './transcript';
import { SUPPORT_WELCOME, type SupportChatMessage, type SupportTab, type SupportTicket } from './types';

const EXIT_MS = 220;

function chatStorageKey(userId: string) {
  return `samyoj.support.chat.${userId}`;
}

function loadMessages(userId: string | undefined): SupportChatMessage[] {
  if (!userId || typeof sessionStorage === 'undefined') return [SUPPORT_WELCOME];
  try {
    const raw = sessionStorage.getItem(chatStorageKey(userId));
    if (!raw) return [SUPPORT_WELCOME];
    const parsed = JSON.parse(raw) as SupportChatMessage[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [SUPPORT_WELCOME];
    return parsed;
  } catch {
    return [SUPPORT_WELCOME];
  }
}

interface SupportBoardProps {
  open: boolean;
  onClose: () => void;
}

export default function SupportBoard({ open, onClose }: SupportBoardProps) {
  const { user } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const handleEscape = useCallback(() => onCloseRef.current(), []);
  const { mounted, phase } = useModalTransition(open, EXIT_MS);

  const [tab, setTab] = useState<SupportTab>('assistant');
  const [messages, setMessages] = useState<SupportChatMessage[]>(() => loadMessages(user?.id));
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [assistantOnline, setAssistantOnline] = useState(true);
  const [escalating, setEscalating] = useState(false);
  const initials = nameInitials(user?.name);

  useEffect(() => {
    setMessages(loadMessages(user?.id));
  }, [user?.id]);

  useFocusTrap({
    ref: panelRef,
    active: mounted && open,
    onEscape: handleEscape,
  });

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onCloseRef.current();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [mounted, open]);

  useEffect(() => {
    if (!open) return;
    supportApi
      .status()
      .then((res) => {
        setAssistantOnline(Boolean(res.data?.data?.assistantOnline));
      })
      .catch(() => setAssistantOnline(false));
  }, [open]);

  useEffect(() => {
    if (!user?.id || typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(chatStorageKey(user.id), JSON.stringify(messages));
    } catch {
      // Private mode / quota — chat still works in memory.
    }
  }, [messages, user?.id]);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await supportApi.listTickets();
      setTickets((res.data?.data?.tickets as SupportTicket[]) || []);
    } catch (err) {
      toastError(getErrorMessage(err, 'Could not load tickets'));
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  const escalate = async () => {
    const payload = toApiChatMessages(messages);
    if (payload.length === 0) return;
    setEscalating(true);
    try {
      await supportApi.escalate(payload);
      toastSuccess('Ticket opened from this chat');
      setTab('tickets');
      await loadTickets();
    } catch (err) {
      toastError(getErrorMessage(err, 'Could not open a ticket from this chat'));
    } finally {
      setEscalating(false);
    }
  };

  if (!mounted || typeof document === 'undefined') return null;

  const panelAnim = phase === 'leaving' ? 'modal-panel--exit' : 'modal-panel--enter';
  const backdropAnim = phase === 'leaving' ? 'modal-backdrop--exit' : 'modal-backdrop--enter';
  const statusText = assistantOnline
    ? 'AI assistant online · tickets available'
    : 'AI assistant offline · tickets available';

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end" role="presentation">
      <button
        type="button"
        className={`modal-backdrop ${backdropAnim}`}
        onClick={onClose}
        aria-label="Close support"
      />
      <div
        ref={panelRef}
        className={`modal-panel ${panelAnim} w-full max-w-none sm:max-w-[min(100vw,26.5rem)]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-board-title"
      >
        <div className="modal-panel__header relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-whatsapp-500 via-emerald-500 to-teal-600" />
          <div className="relative flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#087F5B] text-white shadow-[0_2px_8px_rgba(8,127,91,0.28)]">
                <Headphones className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-theme-muted">
                  Help Center
                </p>
                <h2 id="support-board-title" className="text-[22px] font-extrabold leading-tight tracking-tight text-theme-fg">
                  Support
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-theme-secondary">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${assistantOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    aria-hidden
                  />
                  {statusText}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-800 dark:bg-theme-subtle dark:text-theme-muted dark:hover:bg-theme-border ${FOCUS_RING_CLASS}`}
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>

          <div className="px-4 pb-3 sm:px-5">
            <div
              className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-theme-subtle"
              role="tablist"
              aria-label="Support sections"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'assistant'}
                onClick={() => setTab('assistant')}
                className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-[0.65rem] text-[13px] font-bold transition ${
                  tab === 'assistant'
                    ? 'bg-white text-theme-fg shadow-sm ring-1 ring-emerald-200/80 dark:bg-theme-surface dark:ring-emerald-500/25'
                    : 'text-theme-muted hover:text-theme-fg'
                } ${FOCUS_RING_CLASS}`}
              >
                <MessageSquare className="h-4 w-4" strokeWidth={2.1} />
                Assistant
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'tickets'}
                onClick={() => setTab('tickets')}
                className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-[0.65rem] text-[13px] font-bold transition ${
                  tab === 'tickets'
                    ? 'bg-white text-theme-fg shadow-sm ring-1 ring-emerald-200/80 dark:bg-theme-surface dark:ring-emerald-500/25'
                    : 'text-theme-muted hover:text-theme-fg'
                } ${FOCUS_RING_CLASS}`}
              >
                <Layers className="h-4 w-4" strokeWidth={2.1} />
                Tickets
              </button>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />
              <p className="text-[12px] font-medium leading-snug text-emerald-900 dark:text-emerald-200">
                Product help only. For billing/login/data issues, create a ticket. Don&apos;t share passwords or OTPs.
              </p>
            </div>
          </div>
        </div>

        {tab === 'assistant' ? (
          <SupportAssistantTab
            messages={messages}
            onMessagesChange={setMessages}
            userInitials={initials}
            assistantOnline={assistantOnline}
            onEscalate={() => void escalate()}
            escalating={escalating}
          />
        ) : (
          <SupportTicketsTab tickets={tickets} loading={ticketsLoading} onReload={loadTickets} />
        )}
      </div>
    </div>,
    document.body
  );
}
