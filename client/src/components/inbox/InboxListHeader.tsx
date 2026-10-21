import { useEffect, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AlertTriangle, MoreHorizontal, Plus, RefreshCw, User, X } from 'lucide-react';
import SearchInput from '../ui/SearchInput';
import ChatAiPicker from './ChatAiPicker';
import type { AiBot } from '../../types';
import { useGlassTipProps } from './ComposerGlassTip';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import { useHorizontalWheelScroll } from '../../hooks/useHorizontalWheelScroll';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import type { InboundHealth } from '../../hooks/useWebhookHealth';
import type { InboxSelectOption } from './InboxSelect';
import { getAvatarGradient, getInitials } from './inboxUtils';
import { whatsappNotConnectedCopy } from '../../utils/whatsappConnectionCopy';

const AGENT_MENU_WIDTH = 240;
const AGENT_MENU_GAP = 8;
const AGENT_VISIBLE_COUNT = 3;

export type ListChip =
  | 'all'
  | 'active'
  | 'inactive'
  | 'unread'
  | 'unreplied'
  | 'open'
  | 'favourites'
  | 'pending'
  | 'hasTicket'
  | 'botActive'
  | 'snoozed';

const FILTER_CHIPS: Array<{ chip: ListChip; label: string; title?: string }> = [
  { chip: 'all', label: 'All' },
  { chip: 'active', label: 'Active', title: '24h window open — you can reply' },
  { chip: 'inactive', label: 'Inactive', title: '24h window closed — send a template' },
  { chip: 'unread', label: 'Unread' },
  { chip: 'unreplied', label: 'Unreplied' },
  { chip: 'open', label: 'Open' },
  { chip: 'favourites', label: 'Favorites' },
  { chip: 'pending', label: 'Pending' },
  { chip: 'hasTicket', label: 'Tickets' },
  { chip: 'botActive', label: 'AI Bot' },
];

const MESSENGER_FILTER_CHIPS: Array<{ chip: ListChip; label: string; title?: string }> = [
  { chip: 'all', label: 'All' },
  { chip: 'unread', label: 'Unread' },
  { chip: 'open', label: 'Open' },
  { chip: 'pending', label: 'Pending' },
  { chip: 'favourites', label: 'Favorites' },
];

interface InboxListHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchInputRef?: Ref<HTMLInputElement>;
  chip: ListChip;
  onChipChange: (chip: ListChip) => void;
  conversationTotal: number;
  unreadTotal: number;
  agentFilter: string;
  onAgentFilterChange: (value: string) => void;
  agentOptions: InboxSelectOption[];
  selectionMode: boolean;
  onCancelSelection: () => void;
  onNewChat: () => void;
  onRefresh: () => void;
  inboundHealth?: InboundHealth;
  onRetryHealth: () => void;
  variant?: 'whatsapp' | 'messenger' | 'instagram';
  /** Global AI for all chats on this inbox (list header — WhatsApp number or Meta channel). */
  channelChatAi?: {
    enabled: boolean;
    saving?: boolean;
    disabled?: boolean;
    defaultChatBotId?: string | null;
    chatBots?: AiBot[];
    botsLoading?: boolean;
    botAssigning?: boolean;
    hasBots?: boolean;
    onSelectBot?: (botId: string) => void;
    onChange: (enabled: boolean) => void;
  };
}

const squareBtn = (active = false) =>
  `flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${FOCUS_RING_CLASS} ${
    active
      ? 'border-whatsapp-500/50 bg-whatsapp-500/10 text-whatsapp-700 dark:text-whatsapp-400'
      : 'border-theme-border bg-theme-surface text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg'
  }`;

function formatCountLine(conversationTotal: number, unreadTotal: number) {
  const conversations =
    conversationTotal === 1
      ? `${conversationTotal.toLocaleString()} conversation`
      : `${conversationTotal.toLocaleString()} conversations`;
  const unread = `${unreadTotal.toLocaleString()} unread`;
  return `${conversations} · ${unread}`;
}

function AgentAvatarButton({
  label,
  avatarKey,
  gradientKey,
  active,
  activeRingClass,
  onClick,
  tipFor,
}: {
  label: string;
  avatarKey?: string;
  /** Stable unique key for color (e.g. agent id) — avoids same gradient for different people. */
  gradientKey?: string;
  active: boolean;
  activeRingClass?: string;
  onClick: () => void;
  tipFor: (label: string) => Record<string, unknown>;
}) {
  const colorKey = gradientKey || avatarKey || label;
  const ringWhenActive =
    activeRingClass ??
    'ring-whatsapp-500 ring-offset-1 ring-offset-white dark:ring-offset-neutral-950';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Filter by ${label}`}
      {...tipFor(`Filter by ${label}`)}
      className={`relative z-0 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:z-20 ${FOCUS_RING_CLASS} ${
        active
          ? `z-10 ring-2 ${ringWhenActive}`
          : 'ring-2 ring-white dark:ring-neutral-950'
      }`}
    >
      <span
        className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br text-[9px] font-bold text-white shadow-sm ${getAvatarGradient(colorKey)}`}
      >
        {getInitials(label, avatarKey)}
      </span>
    </button>
  );
}

export default function InboxListHeader({
  search,
  onSearchChange,
  searchInputRef,
  chip,
  onChipChange,
  conversationTotal,
  unreadTotal,
  agentFilter,
  onAgentFilterChange,
  agentOptions,
  selectionMode,
  onCancelSelection,
  onNewChat,
  onRefresh,
  inboundHealth = { state: 'unknown' as const },
  onRetryHealth,
  variant = 'whatsapp',
  channelChatAi,
}: InboxListHeaderProps) {
  const tipFor = useGlassTipProps();
  const [agentsMenuOpen, setAgentsMenuOpen] = useState(false);
  const [agentsMenuPos, setAgentsMenuPos] = useState<{ top: number; right: number } | null>(null);
  const agentsMenuBtnRef = useRef<HTMLButtonElement>(null);
  const agentsMenuRef = useRef<HTMLDivElement>(null);
  const chipRowRef = useHorizontalWheelScroll();
  const { hasConnectedNumber, loading: numberLoading, disconnectedNumbers } = useWhatsAppNumber();

  const isMessenger = variant === 'messenger' || variant === 'instagram';
  const isInstagram = variant === 'instagram';
  const isFbMessenger = variant === 'messenger';
  const chips = isMessenger ? MESSENGER_FILTER_CHIPS : FILTER_CHIPS;
  const chipActiveClass = isInstagram
    ? 'bg-gradient-to-r from-[#9b4dc4] via-[#c13584] to-[#e1306c] text-white shadow-[0_1px_3px_rgba(193,53,132,0.32)]'
    : isFbMessenger
      ? 'bg-[#1877F2] text-white shadow-[0_1px_3px_rgba(24,119,242,0.32)]'
      : 'bg-whatsapp-600 text-white shadow-[0_1px_2px_rgba(37,211,102,0.28)] dark:bg-whatsapp-500';
  const agentRingActiveClass = isInstagram
    ? 'ring-[#c13584] ring-offset-1 ring-offset-white dark:ring-offset-neutral-950'
    : isFbMessenger
      ? 'ring-[#1877F2] ring-offset-1 ring-offset-white dark:ring-offset-neutral-950'
      : 'ring-whatsapp-500 ring-offset-1 ring-offset-white dark:ring-offset-neutral-950';
  const agentMenuActive = isInstagram
    ? 'bg-[#c13584]/15 text-[#9b2c6f] ring-[#c13584]/40 dark:text-[#f472b6]'
    : isFbMessenger
      ? 'bg-[#1877F2]/15 text-[#1565d8] ring-[#1877F2]/40 dark:text-[#60a5fa]'
      : 'bg-whatsapp-500/15 text-whatsapp-700 ring-whatsapp-500/40 dark:text-whatsapp-400';
  const isConnected = hasConnectedNumber && !numberLoading;
  const disconnectedCopy = whatsappNotConnectedCopy(disconnectedNumbers, {
    task: 'open chats and receive replies',
  });
  const listTitle = isInstagram ? 'Instagram' : isFbMessenger ? 'Messenger' : 'Inbox';
  const searchPlaceholder = isInstagram ? 'Search DMs' : isFbMessenger ? 'Search Messenger' : 'Search inbox';
  const countLine = isMessenger
    ? `24h reply window · ${formatCountLine(conversationTotal, unreadTotal)}`
    : formatCountLine(conversationTotal, unreadTotal);
  const selectableAgents = agentOptions.filter((option) => option.value !== '');
  const visibleAgents = selectableAgents.slice(0, AGENT_VISIBLE_COUNT);
  const hiddenActiveFilter =
    Boolean(agentFilter) && !visibleAgents.some((agent) => agent.value === agentFilter);

  useLayoutEffect(() => {
    if (!agentsMenuOpen || !agentsMenuBtnRef.current) {
      setAgentsMenuPos(null);
      return;
    }
    const place = () => {
      const rect = agentsMenuBtnRef.current!.getBoundingClientRect();
      setAgentsMenuPos({
        top: rect.bottom + AGENT_MENU_GAP,
        right: Math.max(AGENT_MENU_GAP, window.innerWidth - rect.right),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [agentsMenuOpen, selectableAgents.length]);

  useEffect(() => {
    if (!agentsMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (agentsMenuBtnRef.current?.contains(target)) return;
      if (agentsMenuRef.current?.contains(target)) return;
      setAgentsMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAgentsMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [agentsMenuOpen]);

  const toggleAgentFilter = (value: string) => {
    onAgentFilterChange(agentFilter === value ? '' : value);
    setAgentsMenuOpen(false);
  };

  return (
    <div className="shrink-0 border-b border-neutral-100 px-3 pb-2 pt-2 dark:border-neutral-800/80 md:pt-3">
      {!isMessenger && !numberLoading && !hasConnectedNumber && (
        <div
          role="status"
          data-testid="whatsapp-disconnected-banner"
          className="mb-2 flex items-center gap-2 rounded-lg border border-amber-300/80 bg-amber-50/95 px-2.5 py-2 text-amber-950 md:mb-3 md:rounded-xl md:px-3 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[11.5px] font-bold">{disconnectedCopy.title}</p>
            <p
              className="mt-0.5 truncate text-[10.5px] font-medium text-amber-900/75 dark:text-amber-200/75"
              title={disconnectedCopy.description}
            >
              Reconnect to receive replies
            </p>
          </div>
          <Link
            to="/settings?tab=whatsapp"
            className={`shrink-0 rounded-md border border-amber-300/80 px-2.5 py-1.5 text-[10px] font-bold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-900/40 ${FOCUS_RING_CLASS}`}
          >
            Reconnect
          </Link>
        </div>
      )}
      {!isMessenger && inboundHealth?.state === 'unhealthy' && isConnected && (
        <div
          role="alert"
          data-testid="inbound-health-banner"
          className={
            inboundHealth.kind === 'off'
              ? 'mb-2 flex items-center gap-2 rounded-lg border border-red-300/80 bg-red-50/95 px-2.5 py-1.5 text-red-900 md:mb-3 md:items-start md:gap-2.5 md:rounded-xl md:px-3 md:py-2.5 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100'
              : 'mb-2 flex items-center gap-2 rounded-lg border border-amber-300/80 bg-amber-50/95 px-2.5 py-1.5 text-amber-950 md:mb-3 md:items-start md:gap-2.5 md:rounded-xl md:px-3 md:py-2.5 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100'
          }
        >
          <AlertTriangle
            className={
              inboundHealth.kind === 'off'
                ? 'h-3.5 w-3.5 shrink-0 text-red-600 md:mt-0.5 md:h-4 md:w-4 dark:text-red-400'
                : 'h-3.5 w-3.5 shrink-0 text-amber-600 md:mt-0.5 md:h-4 md:w-4 dark:text-amber-400'
            }
          />
          <div className="min-w-0 flex-1 text-[11.5px] leading-snug md:text-[12px]">
            <p className="font-bold">
              {inboundHealth.kind === 'off' ? 'Replies aren’t arriving' : 'WhatsApp is busy'}
            </p>
            <p
              className={
                inboundHealth.kind === 'off'
                  ? 'mt-0.5 text-red-800/85 dark:text-red-200/85'
                  : 'mt-0.5 text-amber-900/80 dark:text-amber-200/80'
              }
            >
              {inboundHealth.kind === 'off'
                ? 'Incoming messages aren’t turned on for this number. Open Settings and turn them on.'
                : 'Your number is still connected. Wait a minute, then try again.'}
            </p>
          </div>
          {inboundHealth.kind === 'off' ? (
            <Link
              to="/settings?tab=whatsapp"
              className={`shrink-0 rounded-md border border-red-300/80 px-2 py-1 text-[10px] font-bold text-red-700 transition hover:bg-red-100 md:text-[10.5px] dark:border-red-500/40 dark:text-red-200 dark:hover:bg-red-900/40 ${FOCUS_RING_CLASS}`}
            >
              Settings
            </Link>
          ) : (
            <button
              type="button"
              onClick={onRetryHealth}
              className={`shrink-0 rounded-md border border-amber-300/80 px-2 py-1 text-[10px] font-bold text-amber-800 transition hover:bg-amber-100 md:text-[10.5px] dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-900/40 ${FOCUS_RING_CLASS}`}
            >
              Retry
            </button>
          )}
        </div>
      )}

      <div className={`${selectionMode ? 'flex' : 'hidden'} items-start justify-between gap-2 md:flex`}>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-bold tracking-tight text-theme-fg">{listTitle}</h2>
            {!isMessenger && (
              <InboundStatusDot
                isConnected={isConnected}
                numberLoading={numberLoading}
                inboundHealth={inboundHealth}
              />
            )}
          </div>
          <p
            className="mt-0.5 min-h-[1.125rem] truncate whitespace-nowrap text-[12px] font-medium leading-[1.125rem] text-theme-muted"
            title={countLine}
          >
            {countLine}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {selectionMode ? (
            <button
              type="button"
              onClick={onCancelSelection}
              aria-label="Cancel selection"
              {...tipFor('Cancel selection')}
              data-testid="inbox-cancel-selection"
              className={squareBtn()}
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          ) : (
            <>
              {channelChatAi ? (
                <ChatAiPicker
                  orgMode
                  enabled={channelChatAi.enabled}
                  saving={channelChatAi.saving}
                  disabled={
                    channelChatAi.disabled ??
                    (channelChatAi.hasBots === false && !channelChatAi.botsLoading)
                  }
                  defaultChatBotId={channelChatAi.defaultChatBotId}
                  chatBots={channelChatAi.chatBots}
                  botsLoading={channelChatAi.botsLoading}
                  botAssigning={channelChatAi.botAssigning}
                  onSelectBot={channelChatAi.onSelectBot}
                  onChange={channelChatAi.onChange}
                  showTrainLink
                />
              ) : null}
              <button
                type="button"
                onClick={onRefresh}
                aria-label="Refresh list"
                {...tipFor('Refresh list')}
                data-testid="inbox-refresh-list"
                className={squareBtn()}
              >
                <RefreshCw className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </>
          )}

          {!isMessenger && (
            <button
              type="button"
              onClick={onNewChat}
              data-testid="inbox-new-chat"
              aria-label="Start a new chat"
              {...tipFor('Start a new chat')}
              className={`hidden h-9 items-center justify-center rounded-lg bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 font-bold text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)] transition hover:brightness-105 active:scale-[0.98] md:inline-flex ${FOCUS_RING_CLASS} ${
                channelChatAi ? 'w-9 px-0' : 'gap-1.5 px-3 text-[12.5px]'
              }`}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.75} />
              {channelChatAi ? null : 'New chat'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-0 border-0 pt-0 md:mt-2 md:border-t md:border-neutral-100 md:pt-2 dark:md:border-neutral-800/80">
        <div className="flex items-center gap-2">
          <SearchInput
            ref={searchInputRef}
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 [&_input]:!h-8 [&_input]:rounded-lg [&_input]:!bg-theme-surface [&_input]:!text-[14px] [&_input]:!shadow-none [&_svg]:left-2.5 [&_svg]:!h-3.5 [&_svg]:!w-3.5 [&_input]:!pl-8"
          />

          {selectableAgents.length > 0 && (
            <div className="hidden shrink-0 items-center md:flex">
              <div className="flex items-center -space-x-2">
                {visibleAgents.map((agent) => (
                  <AgentAvatarButton
                    key={agent.value}
                    label={agent.label}
                    avatarKey={agent.avatarKey}
                    gradientKey={agent.value}
                    active={agentFilter === agent.value}
                    activeRingClass={agentRingActiveClass}
                    onClick={() => toggleAgentFilter(agent.value)}
                    tipFor={tipFor}
                  />
                ))}
              </div>
              <div className="relative -ml-1 shrink-0">
                <button
                  ref={agentsMenuBtnRef}
                  type="button"
                  onClick={() => setAgentsMenuOpen((open) => !open)}
                  aria-expanded={agentsMenuOpen}
                  aria-haspopup="menu"
                  aria-label="All agents"
                  data-testid="inbox-agent-overflow"
                  {...tipFor('All agents')}
                  className={`relative z-0 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2 ring-white transition hover:z-20 dark:ring-neutral-950 ${FOCUS_RING_CLASS} ${
                    agentsMenuOpen || hiddenActiveFilter
                      ? agentMenuActive
                      : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                  }`}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
                {agentsMenuOpen &&
                  agentsMenuPos &&
                  createPortal(
                    <div
                      ref={agentsMenuRef}
                      role="menu"
                      aria-label="Filter by agent"
                      data-testid="inbox-agent-menu"
                      style={{
                        top: agentsMenuPos.top,
                        right: agentsMenuPos.right,
                        width: AGENT_MENU_WIDTH,
                      }}
                      className="fixed z-[80] max-h-64 overflow-y-auto rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onAgentFilterChange('');
                          setAgentsMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-semibold transition ${FOCUS_RING_CLASS} ${
                          !agentFilter
                            ? 'bg-whatsapp-500/10 text-whatsapp-800 dark:text-whatsapp-300'
                            : 'text-theme-fg hover:bg-theme-subtle'
                        }`}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-neutral-300 text-[10px] font-bold text-neutral-400">
                          <User className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </span>
                        All agents
                      </button>
                      {selectableAgents.map((agent) => {
                        const active = agentFilter === agent.value;
                        return (
                          <button
                            key={agent.value}
                            type="button"
                            role="menuitem"
                            onClick={() => toggleAgentFilter(agent.value)}
                            className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-semibold transition ${FOCUS_RING_CLASS} ${
                              active
                                ? 'bg-whatsapp-500/10 text-whatsapp-800 dark:text-whatsapp-300'
                                : 'text-theme-fg hover:bg-theme-subtle'
                            }`}
                          >
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white ${getAvatarGradient(agent.value)}`}
                            >
                              {getInitials(agent.label, agent.avatarKey)}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{agent.label}</span>
                          </button>
                        );
                      })}
                    </div>,
                    document.body
                  )}
              </div>
            </div>
          )}
        </div>

        <div
          ref={chipRowRef}
          role="tablist"
          aria-label="Filter conversations"
          aria-live="polite"
          className="-mx-1 mt-2.5 flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain px-1 touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {chips.map((item) => {
            const active = chip === item.chip;
            return (
              <button
                key={item.chip}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`inbox-filter-chip-${item.chip}`}
                title={item.title}
                onClick={() => onChipChange(item.chip)}
                className={`inline-flex h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-2 text-[12px] font-semibold leading-none transition ${FOCUS_RING_CLASS} ${
                  active
                    ? chipActiveClass
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InboundStatusDot({
  isConnected,
  numberLoading,
  inboundHealth,
}: {
  isConnected: boolean;
  numberLoading: boolean;
  inboundHealth: InboundHealth;
}) {
  const tipFor = useGlassTipProps();
  type Tone = 'green' | 'pending' | 'amber' | 'red';
  let tone: Tone = 'pending';
  let label = 'WhatsApp status unknown';

  if (numberLoading || inboundHealth.state === 'loading' || inboundHealth.state === 'unknown') {
    tone = 'pending';
    label =
      numberLoading || inboundHealth.state === 'loading'
        ? 'Checking WhatsApp…'
        : 'WhatsApp status unknown';
  } else if (inboundHealth.state === 'unhealthy' && inboundHealth.kind === 'busy') {
    tone = 'amber';
    label = 'WhatsApp is busy';
  } else if (!isConnected || inboundHealth.state === 'unhealthy') {
    tone = 'red';
    label = isConnected ? 'Replies aren’t arriving' : 'WhatsApp not connected';
  } else if (inboundHealth.state === 'ok') {
    tone = 'green';
    label = 'WhatsApp inbound connected';
  }

  const colorClass =
    tone === 'green'
      ? 'bg-emerald-500'
      : tone === 'red'
        ? 'bg-red-500'
        : tone === 'amber'
          ? 'bg-amber-500'
          : 'bg-neutral-300 dark:bg-neutral-600';

  return (
    <span
      className="relative inline-flex h-2 w-2 shrink-0"
      aria-label={label}
      data-testid="inbound-health-pill"
      role="status"
      {...tipFor(label, 'below')}
    >
      {tone === 'green' && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-45 motion-reduce:animate-none" />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${colorClass}`} />
    </span>
  );
}
