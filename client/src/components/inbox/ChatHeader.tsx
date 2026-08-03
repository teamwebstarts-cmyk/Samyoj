import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Bot,
  CheckCircle2,
  Clock,
  Download,
  LifeBuoy,
  MoreVertical,
  Phone,
  Search,
  Star,
  UserMinus,
  UserPlus,
  XCircle,
} from 'lucide-react';
import ContactAvatar from './ContactAvatar';
import SnoozePopover from './SnoozePopover';
import { ServiceWindowBadge } from './ServiceWindowBanner';
import type { PresenceViewer } from './useConversationPresence';
import type { Conversation, ServiceWindowInfo, TeamAgent } from '../../types';

interface ChatHeaderProps {
  conversation: Conversation;
  /** undefined until the server responds — renders a skeleton pill (tri-state). */
  serviceWindow: ServiceWindowInfo | undefined;
  botIsLive: boolean;
  botToggling: boolean;
  callingBack: boolean;
  assigning: boolean;
  agents: TeamAgent[];
  currentUserId?: string;
  viewers: PresenceViewer[];
  onBack: () => void;
  onCallBack: () => void;
  onSnoozeUntil: (untilIso: string, label: string) => void;
  onUnsnooze: () => void;
  onToggleBot: () => void;
  onToggleFavorite: () => void;
  onToggleSearch: () => void;
  onAssign: (agentId: string | null) => void;
  onStatusChange: (status: string) => void;
  onConvertToTicket: () => void;
  onExport: () => void;
}

function HeaderIconButton({
  label,
  onClick,
  disabled,
  active,
  dot,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-whatsapp-500/50 bg-whatsapp-500/10 text-whatsapp-700 dark:text-whatsapp-400'
          : 'border-theme-border bg-theme-surface text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg'
      }`}
    >
      {children}
      {dot && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-neutral-900" />
      )}
    </button>
  );
}

function PresenceRow({ viewers }: { viewers: PresenceViewer[] }) {
  if (viewers.length === 0) return null;
  const names =
    viewers.length === 1
      ? viewers[0].name
      : `${viewers[0].name} +${viewers.length - 1}`;
  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
      <span className="flex -space-x-1.5">
        {viewers.slice(0, 3).map((viewer) => (
          <span
            key={viewer.id}
            title={viewer.name}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[8px] font-bold text-emerald-700 ring-1 ring-white dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-neutral-900"
          >
            {viewer.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
      </span>
      {names} viewing
    </p>
  );
}

export default function ChatHeader({
  conversation,
  serviceWindow,
  botIsLive,
  botToggling,
  callingBack,
  assigning,
  agents,
  currentUserId,
  viewers,
  onBack,
  onCallBack,
  onSnoozeUntil,
  onUnsnooze,
  onToggleBot,
  onToggleFavorite,
  onToggleSearch,
  onAssign,
  onStatusChange,
  onConvertToTicket,
  onExport,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const snoozeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setAssignOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  useEffect(() => {
    if (!snoozeOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (snoozeRef.current && !snoozeRef.current.contains(e.target as Node)) {
        setSnoozeOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [snoozeOpen]);

  const { contact, status } = conversation;
  const assignedId = conversation.assignedAgent?.id;
  const isSnoozed = Boolean(
    conversation.snoozedUntil && new Date(conversation.snoozedUntil).getTime() > Date.now()
  ) || status === 'SNOOZED';

  const statusItems = [
    { value: 'OPEN', label: 'Mark as open', icon: CheckCircle2 },
    { value: 'PENDING', label: 'Mark as pending', icon: Clock },
    { value: 'CLOSED', label: 'Mark as closed', icon: XCircle },
  ];

  return (
    <div className="inbox-chat-header flex shrink-0 items-center gap-3 border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800/80">
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-theme-border bg-theme-surface text-theme-secondary transition hover:bg-theme-subtle md:hidden"
        onClick={onBack}
        aria-label="Back to conversations"
      >
        <ArrowLeft size={17} strokeWidth={2.25} />
      </button>

      <ContactAvatar name={contact.name} phone={contact.phone} size="sm" shape="circle" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold tracking-tight text-theme-fg">
          {contact.name || contact.phone}
        </p>
        <p className="truncate text-[12.5px] font-medium text-theme-muted">
          {contact.phone}
          {conversation.assignedAgent && (
            <span className="text-emerald-600 dark:text-emerald-400">
              {' '}
              · {conversation.assignedAgent.name}
            </span>
          )}
        </p>
        <PresenceRow viewers={viewers} />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {serviceWindow === undefined ? (
          <span className="inbox-skeleton-shimmer hidden h-6 w-24 rounded-full sm:block" />
        ) : (
          <ServiceWindowBadge serviceWindow={serviceWindow} />
        )}

        <HeaderIconButton label="Call back" onClick={onCallBack} disabled={callingBack}>
          <Phone className="h-4 w-4" strokeWidth={2.1} />
        </HeaderIconButton>

        <HeaderIconButton label="Search in this chat" onClick={onToggleSearch}>
          <Search className="h-4 w-4" strokeWidth={2.1} />
        </HeaderIconButton>

        <div className="relative" ref={snoozeRef}>
          <HeaderIconButton
            label={isSnoozed ? 'Snoozed — manage snooze' : 'Snooze conversation'}
            onClick={() => setSnoozeOpen((v) => !v)}
            dot={isSnoozed}
          >
            <Bell className="h-4 w-4" strokeWidth={2.1} />
          </HeaderIconButton>
          {snoozeOpen && (
            <SnoozePopover
              snoozedUntil={conversation.snoozedUntil}
              onSnooze={onSnoozeUntil}
              onUnsnooze={onUnsnooze}
              onClose={() => setSnoozeOpen(false)}
            />
          )}
        </div>

        <HeaderIconButton
          label={conversation.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          onClick={onToggleFavorite}
        >
          <Star
            className={`h-4 w-4 ${
              conversation.isFavorite
                ? 'fill-amber-400 text-amber-400'
                : ''
            }`}
            strokeWidth={2.1}
          />
        </HeaderIconButton>

        <HeaderIconButton
          label={botIsLive ? 'AI bot on — click to pause' : 'AI bot off — click to enable'}
          onClick={onToggleBot}
          disabled={botToggling}
          active={botIsLive}
        >
          <Bot className="h-4 w-4" strokeWidth={2.1} />
        </HeaderIconButton>

        <div className="relative" ref={menuRef}>
          <HeaderIconButton
            label="More actions"
            onClick={() => {
              setMenuOpen((v) => !v);
              setAssignOpen(false);
            }}
          >
            <MoreVertical className="h-4 w-4" strokeWidth={2.1} />
          </HeaderIconButton>

          {menuOpen && (
            <div className="absolute right-0 top-full z-30 mt-1.5 w-[220px] overflow-hidden rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel">
              <button
                type="button"
                onClick={() => setAssignOpen((v) => !v)}
                aria-expanded={assignOpen}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle"
              >
                <UserPlus className="h-4 w-4 text-emerald-600" />
                Assign agent
                <span className="ml-auto truncate text-[11px] text-theme-muted">
                  {conversation.assignedAgent?.name || 'None'}
                </span>
              </button>
              {assignOpen && (
                <div className="border-y border-theme-border/60 bg-theme-subtle/40 py-1">
                  {currentUserId && agents.some((a) => a.id === currentUserId) && (
                    <button
                      type="button"
                      disabled={assigning}
                      onClick={() => {
                        onAssign(currentUserId);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-[12.5px] text-theme-fg transition hover:bg-theme-subtle disabled:opacity-50"
                    >
                      Assign to me
                      {assignedId === currentUserId && (
                        <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-whatsapp-600" />
                      )}
                    </button>
                  )}
                  {agents
                    .filter((a) => a.id !== currentUserId)
                    .map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        disabled={assigning}
                        onClick={() => {
                          onAssign(agent.id);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-[12.5px] text-theme-fg transition hover:bg-theme-subtle disabled:opacity-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{agent.name}</span>
                          <span className="block truncate text-[10.5px] text-theme-muted">
                            {agent.email}
                          </span>
                        </span>
                        {assignedId === agent.id && (
                          <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-whatsapp-600" />
                        )}
                      </button>
                    ))}
                  <button
                    type="button"
                    disabled={assigning || !assignedId}
                    onClick={() => {
                      onAssign(null);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-[12.5px] text-theme-secondary transition hover:bg-theme-subtle disabled:opacity-50"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    Unassign
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  onConvertToTicket();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle"
              >
                <LifeBuoy className="h-4 w-4 text-violet-600" />
                Convert to ticket
              </button>

              <button
                type="button"
                onClick={() => {
                  onExport();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle"
              >
                <Download className="h-4 w-4 text-sky-600" />
                Export chat
              </button>

              {/* "Mark as unread" is intentionally omitted: the inbox API has
                  no unread-write endpoint and we don't fake client-only state. */}

              <div className="my-1 border-t border-theme-border/60" />

              {statusItems.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  disabled={status === item.value}
                  onClick={() => {
                    onStatusChange(item.value);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle disabled:opacity-50"
                >
                  <item.icon className="h-4 w-4 text-theme-muted" />
                  {item.label}
                  {status === item.value && (
                    <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-whatsapp-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
