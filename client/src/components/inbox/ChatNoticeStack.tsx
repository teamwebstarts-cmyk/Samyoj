import { AlertTriangle, Bot, GitBranch, Phone, Star, Users, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import type { ChatNoticeTone } from './chatNoticeBus';

export type ChatNoticeIcon = 'bot' | 'star' | 'users' | 'flow' | 'alert' | 'phone';

export interface ChatNoticeItem {
  id: string;
  kind: string;
  variant: 'ephemeral' | 'sticky';
  tone: ChatNoticeTone;
  icon: ChatNoticeIcon;
  message: ReactNode;
  action?: { label: string; onClick: () => void };
  /** When true, plays exit animation before unmount (managed by parent). */
  leaving?: boolean;
}

interface ChatNoticeStackProps {
  notices: ChatNoticeItem[];
  onDismiss: (id: string, kind: string, variant: ChatNoticeItem['variant']) => void;
}

const TONE_CARD: Record<ChatNoticeTone, string> = {
  lavender:
    'border-violet-200/70 bg-gradient-to-r from-violet-50/95 to-purple-50/90 text-violet-950 shadow-[0_8px_24px_rgba(109,40,217,0.12)] backdrop-blur-md dark:border-violet-800/40 dark:from-violet-950/70 dark:to-purple-950/60 dark:text-violet-100',
  amber:
    'border-amber-200/70 bg-gradient-to-r from-amber-50/95 to-yellow-50/85 text-amber-950 shadow-[0_8px_24px_rgba(245,158,11,0.14)] backdrop-blur-md dark:border-amber-800/40 dark:from-amber-950/60 dark:to-yellow-950/50 dark:text-amber-100',
  orange:
    'border-orange-200/70 bg-gradient-to-r from-orange-50/95 to-amber-50/85 text-orange-900 shadow-[0_8px_24px_rgba(249,115,22,0.12)] backdrop-blur-md dark:border-orange-800/40 dark:from-orange-950/55 dark:to-amber-950/45 dark:text-orange-200',
};

const TONE_ICON: Record<ChatNoticeTone, string> = {
  lavender:
    'bg-violet-100 text-violet-700 ring-violet-200/70 dark:bg-violet-900/50 dark:text-violet-200 dark:ring-violet-700/40',
  amber:
    'bg-amber-100 text-amber-700 ring-amber-200/70 dark:bg-amber-900/50 dark:text-amber-300 dark:ring-amber-800/40',
  orange:
    'bg-orange-100 text-orange-700 ring-orange-200/70 dark:bg-orange-900/50 dark:text-orange-300 dark:ring-orange-800/40',
};

const TONE_DISMISS: Record<ChatNoticeTone, string> = {
  lavender: 'text-violet-500 hover:bg-violet-100/80 hover:text-violet-800 dark:hover:bg-violet-900/50',
  amber: 'text-amber-500 hover:bg-amber-100/80 hover:text-amber-800 dark:hover:bg-amber-900/50',
  orange: 'text-orange-500 hover:bg-orange-100/80 hover:text-orange-800 dark:hover:bg-orange-900/50',
};

const TONE_ACTION: Record<ChatNoticeTone, string> = {
  lavender: 'text-violet-700 hover:bg-violet-100/80 dark:text-violet-200 dark:hover:bg-violet-900/40',
  amber: 'text-amber-800 hover:bg-amber-100/80 dark:text-amber-200 dark:hover:bg-amber-900/40',
  orange: 'text-orange-800 hover:bg-orange-100/80 dark:text-orange-200 dark:hover:bg-orange-900/40',
};

function NoticeIcon({ icon, tone }: { icon: ChatNoticeIcon; tone: ChatNoticeTone }) {
  const Icon =
    icon === 'star'
      ? Star
      : icon === 'users'
        ? Users
        : icon === 'flow'
          ? GitBranch
          : icon === 'alert'
            ? AlertTriangle
            : icon === 'phone'
              ? Phone
              : Bot;
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ${TONE_ICON[tone]}`}
    >
      <Icon
        className="h-3 w-3"
        strokeWidth={2.2}
        fill={icon === 'star' ? 'currentColor' : 'none'}
        aria-hidden
      />
    </span>
  );
}

/** Absolute stack of compact centered in-chat toasts (under header, over messages). */
export default function ChatNoticeStack({ notices, onDismiss }: ChatNoticeStackProps) {
  if (notices.length === 0) return null;

  return (
    <div
      className="pointer-events-none flex w-full flex-col items-center gap-1.5 px-2 pt-2"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {notices.map((notice) => (
        <div
          key={notice.id}
          role={notice.variant === 'sticky' ? 'status' : 'status'}
          className={`pointer-events-auto relative flex w-fit max-w-[min(92vw,11.5rem)] items-center gap-1.5 rounded-lg border px-2 py-1.5 pr-7 text-[11px] font-semibold leading-tight motion-reduce:animate-none ${
            TONE_CARD[notice.tone]
          } ${notice.leaving ? 'inbox-modal-exit' : 'inbox-modal-enter'}`}
        >
          <NoticeIcon icon={notice.icon} tone={notice.tone} />
          <div className="min-w-0 flex-1 line-clamp-2">{notice.message}</div>
          {notice.action && (
            <button
              type="button"
              onClick={notice.action.onClick}
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold transition ${TONE_ACTION[notice.tone]} ${FOCUS_RING_CLASS}`}
            >
              {notice.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDismiss(notice.id, notice.kind, notice.variant)}
            aria-label="Dismiss notice"
            className={`absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md transition ${TONE_DISMISS[notice.tone]} ${FOCUS_RING_CLASS}`}
          >
            <X className="h-3 w-3" strokeWidth={2.4} />
          </button>
        </div>
      ))}
    </div>
  );
}
