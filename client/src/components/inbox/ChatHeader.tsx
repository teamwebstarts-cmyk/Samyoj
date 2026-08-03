import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Bell,
  Bot,
  CheckCircle2,
  Clock,
  Download,
  LifeBuoy,
  Mail,
  MoreVertical,
  Phone,
  Search,
  Star,
  UserPlus,
  XCircle,
} from 'lucide-react';
import ContactAvatar from './ContactAvatar';
import AssignAgentPopover from './AssignAgentPopover';
import SnoozePopover from './SnoozePopover';
import { ServiceWindowBadge } from './ServiceWindowBanner';
import type { PresenceViewer } from './useConversationPresence';
import type { Conversation, ServiceWindowInfo, TeamAgent } from '../../types';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';

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
  className = '',
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING_CLASS} ${
        active
          ? 'border-whatsapp-500/50 bg-whatsapp-500/10 text-whatsapp-700 dark:text-whatsapp-400'
          : 'border-theme-border bg-theme-surface text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg'
      } ${className}`}
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
  callingBack: _callingBack,
  assigning,
  agents,
  currentUserId,
  viewers,
  onBack,
  onCallBack: _onCallBack,
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
  const [starPulse, setStarPulse] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const snoozeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!menuOpen || !menuBtnRef.current) {
      setMenuPos(null);
      return;
    }
    const place = () => {
      const rect = menuBtnRef.current!.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (menuPanelRef.current?.contains(target)) return;
      setMenuOpen(false);
      setAssignOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setAssignOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const { contact, status } = conversation;
  const assignedId = conversation.assignedAgent?.id;
  const isFavorite = Boolean(conversation.isFavorite);
  const isSnoozed =
    Boolean(conversation.snoozedUntil && new Date(conversation.snoozedUntil).getTime() > Date.now()) ||
    status === 'SNOOZED';

  const avatarPresence =
    status === 'OPEN' || status === 'PENDING' || status === 'CLOSED' || status === 'SNOOZED'
      ? status
      : ('CLOSED' as const);
  const avatarPresenceLabel =
    ({ OPEN: 'Open', PENDING: 'Pending', CLOSED: 'Closed', SNOOZED: 'Snoozed' } as const)[
      avatarPresence
    ];

  const statusItems = [
    { value: 'OPEN', label: 'Mark as open', icon: CheckCircle2 },
    { value: 'PENDING', label: 'Mark as pending', icon: Clock },
    { value: 'CLOSED', label: 'Mark as closed', icon: XCircle },
  ];

  const handleFavoriteClick = () => {
    setStarPulse(true);
    window.setTimeout(() => setStarPulse(false), 280);
    onToggleFavorite();
  };

  const overflowMenu =
    menuOpen && menuPos
      ? createPortal(
          <div
            ref={menuPanelRef}
            role="menu"
            style={{ top: menuPos.top, right: menuPos.right }}
            className="fixed z-[80] w-[220px] overflow-hidden rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel"
          >
            <button
              type="button"
              onClick={() => setAssignOpen((v) => !v)}
              aria-expanded={assignOpen}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle ${FOCUS_RING_CLASS}`}
            >
              <UserPlus className="h-4 w-4 text-emerald-600" />
              Assign agent
              <span className="ml-auto truncate text-[11px] text-theme-muted">
                {conversation.assignedAgent?.name || 'None'}
              </span>
            </button>
            {assignOpen && (
              <div className="relative border-y border-theme-border/60 bg-theme-subtle/40 px-2 py-2">
                <AssignAgentPopover
                  agents={agents}
                  currentUserId={currentUserId}
                  selectedAgentId={assignedId}
                  disabled={assigning}
                  placement="inline"
                  onSelect={(agentId) => {
                    onAssign(agentId);
                    setAssignOpen(false);
                    setMenuOpen(false);
                  }}
                  onClose={() => setAssignOpen(false)}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                onConvertToTicket();
                setMenuOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle ${FOCUS_RING_CLASS}`}
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
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle ${FOCUS_RING_CLASS}`}
            >
              <Download className="h-4 w-4 text-sky-600" />
              Export chat
            </button>

            {/* "Mark as unread" is a planned feature. Surfacing it disabled with
                a tooltip is more honest than silently omitting it. */}
            <button
              type="button"
              disabled
              title="Coming soon — API support in progress"
              aria-label="Mark as unread (coming soon)"
              className="flex w-full cursor-not-allowed items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-muted opacity-60"
            >
              <Mail className="h-4 w-4 text-theme-muted" />
              Mark as unread
              <span className="ml-auto rounded-full bg-theme-subtle px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-theme-muted">
                Soon
              </span>
            </button>

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
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle disabled:opacity-50 ${FOCUS_RING_CLASS}`}
              >
                <item.icon className="h-4 w-4 text-theme-muted" />
                {item.label}
                {status === item.value && (
                  <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-whatsapp-600" />
                )}
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="inbox-chat-header relative z-30 flex shrink-0 items-center gap-3 border-b border-neutral-100/80 px-3 py-3.5 sm:px-4 dark:border-neutral-800/80">
      <button
        type="button"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-theme-border bg-theme-surface text-theme-secondary transition hover:bg-theme-subtle md:hidden ${FOCUS_RING_CLASS}`}
        onClick={onBack}
        aria-label="Back to conversations"
      >
        <ArrowLeft size={17} strokeWidth={2.25} />
      </button>

      <ContactAvatar
        name={contact.name}
        phone={contact.phone}
        size="sm"
        shape="circle"
        presence={avatarPresence}
        presenceLabel={avatarPresenceLabel}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold tracking-tight text-theme-fg">
          {contact.name || contact.phone}
        </p>
        <p className="hidden truncate text-[12.5px] font-medium text-theme-muted sm:block">
          {contact.phone}
        </p>
        <PresenceRow viewers={viewers} />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {serviceWindow === undefined ? (
          <span className="inbox-skeleton-shimmer hidden h-9 w-[7.5rem] rounded-[10px] sm:block" />
        ) : (
          <ServiceWindowBadge serviceWindow={serviceWindow} />
        )}

        <HeaderIconButton
          label="Calling coming soon"
          disabled
          className="opacity-45 grayscale"
        >
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
              anchorRef={snoozeRef}
              snoozedUntil={conversation.snoozedUntil}
              onSnooze={onSnoozeUntil}
              onUnsnooze={onUnsnooze}
              onClose={() => setSnoozeOpen(false)}
            />
          )}
        </div>

        <HeaderIconButton
          label={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          onClick={handleFavoriteClick}
          className={
            isFavorite
              ? 'border-amber-300/80 bg-amber-50 text-amber-600 hover:bg-amber-100/90 hover:text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-400'
              : 'hover:border-amber-200 hover:text-amber-500'
          }
        >
          <Star
            className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${
              isFavorite ? 'fill-amber-400 text-amber-500 dark:fill-amber-400 dark:text-amber-400' : ''
            } ${starPulse ? 'scale-125' : 'scale-100'}`}
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
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => {
              setMenuOpen((v) => !v);
              setAssignOpen(false);
            }}
            title="More actions"
            aria-label="More actions"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-theme-border bg-theme-surface text-theme-secondary transition hover:bg-theme-subtle hover:text-theme-fg ${FOCUS_RING_CLASS} ${
              menuOpen ? 'border-theme-fg/20 bg-theme-subtle text-theme-fg' : ''
            }`}
          >
            <MoreVertical className="h-4 w-4" strokeWidth={2.1} />
          </button>
          {overflowMenu}
        </div>
      </div>
    </div>
  );
}
