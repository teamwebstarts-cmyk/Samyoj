import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { FOCUS_RING_CLASS, useFocusTrap } from '../../hooks/inboxA11y';
import { useModalTransition } from '../../hooks/useModalTransition';
import { modalIconAccents } from '../ui/accentTokens';
import { supportApi } from '../../services/api';
import SupportAssistantTab from './SupportAssistantTab';
import { nameInitials } from './transcript';
import { SUPPORT_WELCOME, type SupportChatMessage } from './types';

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

function statusCopy(assistantOnline: boolean | null) {
  if (assistantOnline === null) return 'Checking…';
  if (assistantOnline) return 'Ready to help';
  return 'Temporarily unavailable';
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

  const [messages, setMessages] = useState<SupportChatMessage[]>(() => loadMessages(user?.id));
  const [assistantOnline, setAssistantOnline] = useState<boolean | null>(null);
  const initials = nameInitials(user?.name);
  const hasChat = messages.some((m) => m.role === 'user');

  const resetChat = () => {
    setMessages([SUPPORT_WELCOME]);
    if (user?.id && typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(chatStorageKey(user.id));
      } catch {
        // ignore
      }
    }
  };

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
    setAssistantOnline(null);
    supportApi
      .status()
      .then((res) => {
        setAssistantOnline(Boolean(res.data?.data?.assistantOnline));
      })
      .catch(() => {
        setAssistantOnline(false);
      });
  }, [open]);

  useEffect(() => {
    if (!user?.id || typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(chatStorageKey(user.id), JSON.stringify(messages));
    } catch {
      // Private mode / quota — chat still works in memory.
    }
  }, [messages, user?.id]);

  if (!mounted || typeof document === 'undefined') return null;

  const panelAnim = phase === 'leaving' ? 'modal-panel--exit' : 'modal-panel--enter';
  const backdropAnim = phase === 'leaving' ? 'modal-backdrop--exit' : 'modal-backdrop--enter';
  const statusText = statusCopy(assistantOnline);
  const statusDot =
    assistantOnline === null
      ? 'bg-neutral-400'
      : assistantOnline
        ? 'bg-sky-500'
        : 'bg-amber-500';

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
        tabIndex={-1}
        className={`modal-panel ${panelAnim} w-full max-w-none sm:max-w-[min(100vw,36rem)]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-board-title"
      >
        <div className="modal-panel__header relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600" />
          <div className="relative flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${modalIconAccents.sky}`}
              >
                <CircleHelp className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 pt-0.5">
                <h2 id="support-board-title" className="text-title tracking-tight text-theme-fg">
                  Support assistant
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-theme-secondary">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot}`} aria-hidden />
                  {statusText}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-start gap-1">
              {hasChat && (
                <button
                  type="button"
                  onClick={resetChat}
                  className={`hidden h-9 items-center rounded-xl px-2.5 text-[11.5px] font-bold text-theme-secondary transition hover:bg-theme-subtle hover:text-theme-fg sm:inline-flex ${FOCUS_RING_CLASS}`}
                >
                  New chat
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-theme-subtle text-theme-muted transition hover:bg-theme-border hover:text-theme-fg ${FOCUS_RING_CLASS}`}
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <SupportAssistantTab
            messages={messages}
            onMessagesChange={setMessages}
            userInitials={initials}
            assistantOnline={assistantOnline}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
