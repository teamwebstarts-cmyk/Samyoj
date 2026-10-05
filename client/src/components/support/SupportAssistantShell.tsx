import { CircleHelp, X } from 'lucide-react';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import { modalIconAccents } from '../ui/accentTokens';
import SupportAssistantTab from './SupportAssistantTab';
import { nameInitials } from './transcript';
import { statusCopy, useSupportChat } from './useSupportChat';

interface SupportAssistantShellProps {
  active: boolean;
  variant: 'drawer' | 'page';
  onClose?: () => void;
}

export default function SupportAssistantShell({ active, variant, onClose }: SupportAssistantShellProps) {
  const {
    user,
    messages,
    setMessages,
    assistantOnline,
    reason,
    dailyCap,
    dailyUsed,
    refreshStatus,
    resetChat,
    hasChat,
  } = useSupportChat(active);
  const initials = nameInitials(user?.name);
  const statusText = statusCopy(reason, assistantOnline, { dailyCap, dailyUsed });
  const statusDot =
    reason === 'checking' || assistantOnline === null
      ? 'bg-neutral-400'
      : reason === 'ready'
        ? 'bg-sky-500'
        : reason === 'daily_cap' || reason === 'disabled'
          ? 'bg-amber-500'
          : 'bg-amber-500';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="modal-panel__header relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600" />
        <div className="relative flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${modalIconAccents.sky}`}>
              <CircleHelp className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 id="support-board-title" className="text-title tracking-tight text-theme-fg">
                Help assistant
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
            {variant === 'drawer' && onClose ? (
              <button
                type="button"
                onClick={onClose}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-theme-subtle text-theme-muted transition hover:bg-theme-border hover:text-theme-fg ${FOCUS_RING_CLASS}`}
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <SupportAssistantTab
          messages={messages}
          onMessagesChange={setMessages}
          userInitials={initials}
          assistantOnline={assistantOnline}
          onAssistantReply={refreshStatus}
        />
      </div>
    </div>
  );
}
