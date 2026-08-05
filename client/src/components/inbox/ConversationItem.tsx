import { Check, Clock, GitBranch, LifeBuoy, Star } from 'lucide-react';
import ContactAvatar from './ContactAvatar';
import { useGlassTipProps } from './ComposerGlassTip';
import {
  softStatusPillClassName,
  softStatusPillStyle,
} from './details/DetailsSectionCard';
import { formatListTime, getMessagePreview } from './inboxUtils';
import { useTheme } from '../../contexts/ThemeContext';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import type { Conversation } from '../../types';

interface ConversationItemProps {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  hasTicket?: boolean;
  selectable?: boolean;
  checked?: boolean;
  onToggleSelect?: () => void;
  currentUserId?: string;
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  PENDING: 'Pending',
  CLOSED: 'Closed',
  SNOOZED: 'Snoozed',
};

function slaBadge(conversation: Conversation, tipFor: ReturnType<typeof useGlassTipProps>) {
  if (conversation.slaBreached) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-md bg-red-100/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-700 dark:bg-red-950/50 dark:text-red-300"
        {...tipFor('First-response SLA breached')}
      >
        SLA
      </span>
    );
  }
  const dueAt = conversation.slaDueAt ? new Date(conversation.slaDueAt).getTime() : null;
  if (dueAt && dueAt > Date.now() && dueAt - Date.now() <= 60 * 60 * 1000) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-md bg-amber-100/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
        {...tipFor('First response due within the hour')}
      >
        <Clock className="h-2.5 w-2.5 shrink-0" />
      </span>
    );
  }
  return null;
}

export default function ConversationItem({
  conversation,
  selected,
  onSelect,
  onContextMenu,
  hasTicket,
  selectable = false,
  checked = false,
  onToggleSelect,
  currentUserId,
}: ConversationItemProps) {
  const tipFor = useGlassTipProps();
  const { resolved: themeResolved } = useTheme();
  const { contact, unreadCount, lastMessageAt, messages, assignedAgent, activeFlow, status } =
    conversation;
  const preview = getMessagePreview(messages?.[0]);
  const hasUnread = unreadCount > 0;
  const statusLabel = STATUS_LABEL[status] || STATUS_LABEL.CLOSED;
  const statusPillStyle = softStatusPillStyle(status, { dark: themeResolved === 'dark' });

  const agentLabel = assignedAgent
    ? currentUserId && assignedAgent.id === currentUserId
      ? 'You'
      : assignedAgent.name
    : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      onContextMenu={onContextMenu}
      aria-current={selected ? 'true' : undefined}
      className={`group relative flex w-full items-start gap-3 px-3 py-3 text-left sm:px-4 ${FOCUS_RING_CLASS} ${
        checked
          ? 'bg-whatsapp-500/10 dark:bg-whatsapp-400/12'
          : selected
            ? 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-200/70 dark:bg-emerald-950/30 dark:ring-emerald-900/60'
            : 'bg-transparent hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
      }`}
    >
      {selected && !checked && (
        <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-emerald-500" />
      )}
      {selectable && (
        <span
          role="checkbox"
          aria-checked={checked}
          aria-label="Select conversation"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onToggleSelect?.();
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={`mt-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${FOCUS_RING_CLASS} ${
            checked
              ? 'border-whatsapp-500 bg-gradient-to-br from-whatsapp-400 to-whatsapp-600 text-white shadow-[0_1px_3px_rgba(37,211,102,0.35)]'
              : 'border-neutral-200 bg-white dark:border-neutral-500/45 dark:bg-neutral-900/50'
          }`}
        >
          {checked && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
      )}

      <ContactAvatar
        name={contact.name}
        phone={contact.phone}
        size="sm"
        shape="circle"
        presence={
          status === 'OPEN' || status === 'PENDING' || status === 'CLOSED' || status === 'SNOOZED'
            ? status
            : 'CLOSED'
        }
        presenceLabel={statusLabel}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-bold leading-tight text-theme-fg">
              {contact.name || contact.phone}
            </span>
            {conversation.isFavorite && (
              <span
                className="inline-flex shrink-0"
                aria-label="Favourited"
                {...tipFor('Favourited')}
              >
                <Star
                  className="h-3 w-3 fill-amber-400 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
                  strokeWidth={2}
                  aria-hidden
                />
              </span>
            )}
          </div>
          {lastMessageAt && (
            <span
              className={`shrink-0 text-[11px] tabular-nums ${
                hasUnread
                  ? 'font-bold text-whatsapp-600 dark:text-whatsapp-400'
                  : 'font-medium text-theme-muted'
              }`}
            >
              {formatListTime(lastMessageAt)}
            </span>
          )}
        </div>

        <p
          className={`mt-0.5 truncate text-[12.5px] leading-snug ${
            hasUnread ? 'font-medium text-theme-secondary' : 'text-theme-muted'
          }`}
        >
          {preview}
        </p>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
            <span className={softStatusPillClassName} style={statusPillStyle}>
              {statusLabel}
            </span>
            {agentLabel && (
              <>
                <span
                  className="mx-0.5 h-3 w-px shrink-0 bg-neutral-200/90 dark:bg-neutral-700/90"
                  aria-hidden
                />
                <span className="truncate text-[11px] font-medium text-theme-muted">{agentLabel}</span>
              </>
            )}
            {slaBadge(conversation, tipFor)}
            {hasTicket && (
              <span
                className="inline-flex items-center gap-0.5 rounded-md bg-violet-100/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                {...tipFor('Has open ticket')}
              >
                <LifeBuoy className="h-2.5 w-2.5 shrink-0" />
              </span>
            )}
            {activeFlow && (
              <span
                className="inline-flex max-w-[90px] items-center gap-0.5 truncate rounded-md bg-violet-100/90 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                {...tipFor(activeFlow.currentStepLabel || 'Active flow')}
              >
                <GitBranch className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{activeFlow.currentStepLabel || 'Flow'}</span>
              </span>
            )}
          </div>

          {hasUnread && (
            <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center self-end rounded-full bg-gradient-to-br from-whatsapp-400 to-whatsapp-600 px-1 text-[10px] font-bold text-white shadow-[0_2px_6px_rgba(37,211,102,0.4)]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>

      <ConversationPreviewHover
        contactName={contact.name}
        contactPhone={contact.phone}
        lastMessage={preview}
        preview={preview}
        lastMessageAt={lastMessageAt}
        status={status}
      />
    </button>
  );
}

function useHoverPreviewAllowed() {
  if (typeof window === 'undefined') return false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;
  return !reducedMotion && !isTouch;
}

function ConversationPreviewHover({
  contactName,
  contactPhone,
  lastMessage,
  preview,
  lastMessageAt,
  status,
}: {
  contactName?: string;
  contactPhone?: string;
  lastMessage: string;
  preview: string;
  lastMessageAt?: string;
  status: string;
}) {
  const allowed = useHoverPreviewAllowed();
  if (!allowed) return null;
  const time = lastMessageAt ? new Date(lastMessageAt).toLocaleString() : '';
  return (
    <div
      role="presentation"
      className="inbox-row-preview pointer-events-none invisible absolute right-3 top-full z-30 mt-1 w-[280px] rounded-xl border border-theme-border bg-theme-surface/95 p-3 text-[12px] text-theme-fg opacity-0 shadow-panel ring-1 ring-black/5 backdrop-blur transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      data-testid="conversation-preview"
    >
      <p className="truncate text-[12.5px] font-bold text-theme-fg">{contactName || contactPhone}</p>
      {contactName && contactPhone && (
        <p className="truncate text-[10.5px] font-medium text-theme-muted">{contactPhone}</p>
      )}
      <p className="mt-1.5 line-clamp-3 text-[11.5px] text-theme-secondary">{lastMessage || preview}</p>
      <p className="mt-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wide text-theme-muted">
        <span>{status}</span>
        {time && <span>· {time}</span>}
      </p>
    </div>
  );
}
