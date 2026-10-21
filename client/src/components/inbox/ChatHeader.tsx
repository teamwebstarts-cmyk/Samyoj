import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  Loader2,
  PanelRight,
  Phone,
  Search,
  Star,
  UserPlus,
} from 'lucide-react';
import ContactAvatar from './ContactAvatar';
import AssignAgentPopover from './AssignAgentPopover';
import BotPickerPopover from './BotPickerPopover';
import { ServiceWindowBadge } from './ServiceWindowBanner';
import { useGlassTipProps } from './ComposerGlassTip';
import type { PresenceViewer } from './useConversationPresence';
import type { AiBot, Conversation, ServiceWindowInfo, TeamAgent } from '../../types';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import { waitingForLabel } from '../../utils/flow-waiting';
import {
  formatInstagramContactTitle,
  formatMessengerContactTitle,
  instagramProfileUrlFromContact,
  isInstagramPlaceholderContactName,
  isMessengerPlaceholderContactName,
} from './inboxUtils';

interface ChatHeaderProps {
  conversation: Conversation;
  /** undefined until the server responds — renders a skeleton pill (tri-state). */
  serviceWindow: ServiceWindowInfo | undefined;
  botIsLive: boolean;
  canUseAi?: boolean;
  globalChatLocked?: boolean;
  botToggling: boolean;
  botAssigning?: boolean;
  bots?: AiBot[];
  botsLoading?: boolean;
  callingBack: boolean;
  assigning: boolean;
  agents: TeamAgent[];
  currentUserId?: string;
  viewers: PresenceViewer[];
  onBack: () => void;
  onCallBack: () => void;
  onAssign: (agentId: string | null) => void;
  onToggleBot: () => void;
  onSetActiveBot?: (botId: string | null) => void;
  onToggleFavorite: () => void;
  onToggleSearch: () => void;
  onOpenDetails?: () => void;
  hideCall?: boolean;
  hideBot?: boolean;
  hideFavorite?: boolean;
  windowVariant?: 'whatsapp' | 'messenger' | 'instagram';
  /** Instagram / Messenger: header bot controls all DMs on the channel. */
  channelGlobalBot?: boolean;
  globalDefaultBotId?: string | null;
}

function HeaderIconButton({
  label,
  onClick,
  disabled,
  active,
  pressed,
  className = '',
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  pressed?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const tipFor = useGlassTipProps();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      {...tipFor(label)}
      className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border transition disabled:cursor-not-allowed disabled:opacity-45 md:h-9 md:w-9 ${FOCUS_RING_CLASS} ${
        active
          ? 'border-whatsapp-500/50 bg-whatsapp-500/10 text-whatsapp-700 dark:text-whatsapp-400'
          : 'border-theme-border bg-theme-surface text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg'
      } ${className}`}
    >
      {children}
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
  canUseAi = true,
  globalChatLocked = false,
  botToggling,
  botAssigning = false,
  bots = [],
  botsLoading = false,
  callingBack,
  assigning,
  agents,
  currentUserId,
  viewers,
  onBack,
  onCallBack,
  onAssign,
  onToggleBot,
  onSetActiveBot,
  onToggleFavorite,
  onToggleSearch,
  onOpenDetails,
  hideCall = false,
  hideBot = false,
  hideFavorite = false,
  windowVariant = 'whatsapp',
  channelGlobalBot = false,
  globalDefaultBotId = null,
}: ChatHeaderProps) {
  const assignAccentClass =
    windowVariant === 'instagram'
      ? 'text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/40'
      : windowVariant === 'messenger'
        ? 'text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40'
        : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40';
  const assignOpenClass =
    windowVariant === 'instagram'
      ? 'border-fuchsia-500/50 bg-fuchsia-500/10'
      : windowVariant === 'messenger'
        ? 'border-sky-500/50 bg-sky-500/10'
        : 'border-whatsapp-500/50 bg-whatsapp-500/10';
  const tipFor = useGlassTipProps();
  const [botMenuOpen, setBotMenuOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [starPulse, setStarPulse] = useState(false);
  const botBtnRef = useRef<HTMLButtonElement>(null);
  const assignBtnRef = useRef<HTMLButtonElement>(null);

  const { contact, status } = conversation;
  const isFavorite = Boolean(conversation.isFavorite);
  const assignedId = conversation.assignedAgent?.id;

  const botDisplayName = useMemo(() => {
    if (channelGlobalBot) {
      const picked =
        bots.find((b) => b.id === globalDefaultBotId) ??
        bots.find((b) => b.isDefault && b.enabled) ??
        bots.find((b) => b.enabled);
      if (picked?.name) return picked.name;
    }
    if (globalChatLocked) {
      const globalBot =
        bots.find((b) => b.appliedToAll && b.enabled) ??
        bots.find((b) => b.isDefault && b.enabled) ??
        bots.find((b) => b.enabled);
      if (globalBot?.name) return globalBot.name;
    }
    if (conversation.activeBot?.name) return conversation.activeBot.name;
    const enabled = bots.filter((b) => b.enabled && (b.channel ?? 'CHAT') === 'CHAT');
    const defaultBot = enabled.find((b) => b.isDefault) ?? enabled[0];
    return defaultBot?.name || 'AI Bot';
  }, [channelGlobalBot, conversation.activeBot?.name, bots, globalChatLocked, globalDefaultBotId]);

  const botTipDetail = useMemo(() => {
    if (channelGlobalBot) {
      return botIsLive ? 'AI on for all DMs' : 'AI off for all DMs';
    }
    if (globalChatLocked) {
      return 'Global AI on for all chats';
    }
    if (conversation.activeBot?.name) return conversation.activeBot.name;
    const enabled = bots.filter((b) => b.enabled && (b.channel ?? 'CHAT') === 'CHAT');
    const defaultBot = enabled.find((b) => b.isDefault) ?? enabled[0];
    return defaultBot?.name || 'Choose chatbot';
  }, [botIsLive, channelGlobalBot, conversation.activeBot?.name, bots, globalChatLocked]);

  const avatarPresence =
    status === 'OPEN' || status === 'PENDING' || status === 'CLOSED' || status === 'SNOOZED'
      ? status
      : ('CLOSED' as const);
  const avatarPresenceLabel =
    ({ OPEN: 'Open', PENDING: 'Pending', CLOSED: 'Closed', SNOOZED: 'Snoozed' } as const)[
      avatarPresence
    ];

  const handleFavoriteClick = () => {
    setStarPulse(true);
    window.setTimeout(() => setStarPulse(false), 280);
    onToggleFavorite();
  };

  const isInstagram = windowVariant === 'instagram';
  const isMessenger = windowVariant === 'messenger';
  const contactTitle = isInstagram
    ? formatInstagramContactTitle(contact)
    : isMessenger
      ? formatMessengerContactTitle(contact)
      : contact.name || contact.phone || '';
  const instagramProfileUrl = isInstagram ? instagramProfileUrlFromContact(contact) : null;
  const showInstagramSubtitle =
    isInstagram && !instagramProfileUrl && isInstagramPlaceholderContactName(contact.name);
  const showMessengerSubtitle =
    isMessenger && isMessengerPlaceholderContactName(contact.name);

  const identityBlock = (
    <>
      <ContactAvatar
        name={contact.name}
        phone={contact.phone}
        size="sm"
        shape="squircle"
        presence={avatarPresence}
        presenceLabel={avatarPresenceLabel}
      />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1">
          <p className="truncate text-[14px] font-bold tracking-tight text-theme-fg sm:text-[15px]">
            {contactTitle}
          </p>
          {isFavorite && (
            <span
              className="inline-flex shrink-0"
              aria-label="Favourited"
              {...tipFor('Favourited')}
            >
              <Star
                className="h-3.5 w-3.5 fill-amber-400 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
                strokeWidth={2}
                aria-hidden
              />
            </span>
          )}
        </div>
        {conversation.whatsappAd && (
          <span
            role="status"
            className="mt-0.5 inline-flex h-8 max-w-full items-center gap-1.5 truncate rounded-[10px] border border-emerald-200/80 bg-emerald-50 px-2.5 text-[12.5px] font-semibold leading-none tracking-wide text-emerald-800 md:h-9 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300"
            {...tipFor(conversation.whatsappAd.name || 'WhatsApp ad')}
            aria-label={
              conversation.whatsappAd.name
                ? `WhatsApp ad: ${conversation.whatsappAd.name}`
                : 'WhatsApp ad'
            }
          >
            <span className="shrink-0">WhatsApp ad</span>
            {conversation.whatsappAd.name && (
              <span className="min-w-0 truncate font-medium opacity-90">
                · {conversation.whatsappAd.name}
              </span>
            )}
          </span>
        )}
        {!isInstagram && !isMessenger && (
          <p className="hidden truncate text-[12.5px] font-medium text-theme-muted sm:block">
            {contact.phone}
          </p>
        )}
        {showMessengerSubtitle && (
          <p className="hidden truncate text-[12.5px] font-medium text-theme-muted sm:block">
            Facebook Messenger
          </p>
        )}
        {showInstagramSubtitle && (
          <p className="hidden truncate text-[12.5px] font-medium text-theme-muted sm:block">
            Instagram
          </p>
        )}
        {waitingForLabel(conversation.activeFlow?.waitingFor) && (
          <p className="truncate text-[11px] font-medium text-violet-700 dark:text-violet-300">
            {waitingForLabel(conversation.activeFlow?.waitingFor)}
          </p>
        )}
        <PresenceRow viewers={viewers} />
      </div>
    </>
  );

  return (
    <div className="inbox-chat-header relative z-30 flex shrink-0 items-center gap-1.5 border-b border-neutral-100/80 px-2 py-2.5 sm:gap-2 sm:px-3 sm:py-3 md:gap-3 md:px-4 md:py-3.5 dark:border-neutral-800/80">
      <button
        type="button"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-theme-fg md:hidden ${FOCUS_RING_CLASS}`}
        onClick={onBack}
        aria-label="Back to conversations"
        {...tipFor('Back', 'right')}
      >
        <ArrowLeft size={17} strokeWidth={2.25} />
      </button>

      {instagramProfileUrl ? (
        <a
          href={instagramProfileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-xl py-0.5 pr-1 transition hover:bg-neutral-50/90 sm:gap-2 dark:hover:bg-neutral-800/50 ${FOCUS_RING_CLASS}`}
          aria-label={`Open ${contactTitle} on Instagram`}
          {...tipFor('View on Instagram')}
        >
          {identityBlock}
        </a>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">{identityBlock}</div>
      )}

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 md:gap-1.5">
        {onOpenDetails && (
          <button
            type="button"
            onClick={onOpenDetails}
            aria-label="Chat details"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-600 md:hidden dark:text-neutral-300 ${FOCUS_RING_CLASS}`}
          >
            <PanelRight className="h-[18px] w-[18px]" strokeWidth={2.1} />
          </button>
        )}
        {serviceWindow === undefined ? (
          <span className="inbox-skeleton-shimmer hidden h-8 w-[6.5rem] rounded-[10px] md:h-9 md:w-[7.5rem] sm:block" />
        ) : (
          <ServiceWindowBadge serviceWindow={serviceWindow} variant={windowVariant} />
        )}

        {!hideCall && (
        <HeaderIconButton
          label={callingBack ? 'Starting call…' : 'Start a call'}
          onClick={onCallBack}
          disabled={callingBack}
          active={callingBack}
        >
          {callingBack ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.1} />
          ) : (
            <Phone className="h-4 w-4" strokeWidth={2.1} />
          )}
        </HeaderIconButton>
        )}

        <HeaderIconButton label="Search in this chat" onClick={onToggleSearch} className="max-sm:hidden">
          <Search className="h-4 w-4" strokeWidth={2.1} />
        </HeaderIconButton>

        {!hideFavorite && !isFavorite && (
          <HeaderIconButton
            label="Add to favourites"
            onClick={handleFavoriteClick}
            className="max-sm:hidden hover:border-amber-200 hover:text-amber-500"
          >
            <Star className="h-4 w-4" strokeWidth={2.1} />
          </HeaderIconButton>
        )}

        {!hideFavorite && isFavorite && (
          <HeaderIconButton
            label="Remove from favourites"
            onClick={handleFavoriteClick}
            className="hidden border-amber-300/80 bg-amber-50 text-amber-600 hover:bg-amber-100/90 hover:text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-400 sm:flex"
          >
            <Star
              className={`h-4 w-4 fill-amber-400 text-amber-500 transition-transform duration-200 motion-reduce:transition-none dark:fill-amber-400 dark:text-amber-400 ${
                starPulse ? 'scale-125' : 'scale-100'
              }`}
              strokeWidth={2.1}
            />
          </HeaderIconButton>
        )}

        {!hideBot && (
        <div className="relative">
          <button
            ref={botBtnRef}
            type="button"
            onClick={() => {
              setAssignOpen(false);
              setBotMenuOpen((v) => !v);
            }}
            disabled={!canUseAi || botToggling || botAssigning}
            aria-label={`${botIsLive ? 'Automations live' : 'Automations off'} · ${botTipDetail}. Open bot menu`}
            aria-expanded={botMenuOpen}
            aria-haspopup="dialog"
            {...tipFor(
              botIsLive
                ? `Automations live · ${botTipDetail}`
                : `Automations off · ${botTipDetail}`
            )}
            className={`relative flex h-8 max-w-[11.5rem] shrink-0 items-center gap-1.5 rounded-[10px] border px-2 transition disabled:cursor-not-allowed disabled:opacity-45 md:h-9 ${FOCUS_RING_CLASS} ${
              botMenuOpen
                ? 'border-whatsapp-500/50 bg-whatsapp-500/10 text-whatsapp-700 dark:text-whatsapp-400'
                : botIsLive
                  ? 'border-whatsapp-500/40 bg-whatsapp-500/8 text-whatsapp-700 hover:bg-whatsapp-500/12 dark:text-whatsapp-400'
                  : 'border-theme-border bg-theme-surface text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg'
            } max-md:h-8 max-md:w-8 max-md:justify-center max-md:px-0`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full max-md:absolute max-md:bottom-1 max-md:right-1 ${
                botIsLive ? 'bg-whatsapp-500' : 'bg-neutral-300 dark:bg-neutral-600'
              }`}
              aria-hidden
            />
            <Bot className="h-4 w-4 shrink-0" strokeWidth={2.1} />
            <span className="hidden min-w-0 flex-1 truncate text-left text-[12px] font-semibold tracking-tight md:block">
              {botDisplayName}
            </span>
            {botToggling ? (
              <Loader2 className="hidden h-3.5 w-3.5 shrink-0 animate-spin opacity-70 md:block" strokeWidth={2.25} />
            ) : (
              <ChevronDown
                className={`hidden h-3.5 w-3.5 shrink-0 opacity-70 transition md:block ${botMenuOpen ? 'rotate-180' : ''}`}
                strokeWidth={2.25}
              />
            )}
          </button>
          {botMenuOpen && (
            <BotPickerPopover
              bots={bots}
              loading={botsLoading}
              activeBotId={
                channelGlobalBot
                  ? (globalDefaultBotId ??
                    bots.find((b) => b.isDefault && b.enabled)?.id ??
                    bots.find((b) => b.enabled)?.id ??
                    null)
                  : (conversation.activeBot?.id ?? null)
              }
              botIsLive={botIsLive}
              globalChatLocked={globalChatLocked}
              channelInbox={channelGlobalBot}
              botToggling={botToggling}
              botAssigning={botAssigning}
              anchorRef={botBtnRef}
              onToggleBot={onToggleBot}
              onSelectBot={(botId) => {
                onSetActiveBot?.(botId);
              }}
              onClose={() => setBotMenuOpen(false)}
            />
          )}
        </div>
        )}

        <div className="relative">
          <button
            ref={assignBtnRef}
            type="button"
            aria-label={
              conversation.assignedAgent?.name
                ? `Assign agent · ${conversation.assignedAgent.name}`
                : 'Assign agent'
            }
            aria-expanded={assignOpen}
            disabled={assigning}
            onClick={() => {
              setBotMenuOpen(false);
              setAssignOpen((open) => !open);
            }}
            {...tipFor(
              conversation.assignedAgent?.name
                ? `Assign · ${conversation.assignedAgent.name}`
                : 'Assign agent'
            )}
            className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-theme-border bg-theme-surface transition disabled:cursor-not-allowed disabled:opacity-45 md:h-9 md:w-9 ${FOCUS_RING_CLASS} ${assignAccentClass} ${
              assignOpen ? assignOpenClass : ''
            }`}
          >
            <UserPlus className="h-4 w-4" strokeWidth={2.1} />
          </button>
          {assignOpen && (
            <AssignAgentPopover
              agents={agents}
              currentUserId={currentUserId}
              selectedAgentId={assignedId}
              disabled={assigning}
              placement="below"
              anchorRef={assignBtnRef}
              onSelect={(agentId) => {
                onAssign(agentId);
                setAssignOpen(false);
              }}
              onClose={() => setAssignOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
