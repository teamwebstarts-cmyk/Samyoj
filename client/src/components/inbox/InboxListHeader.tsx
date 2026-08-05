import { useEffect, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Bot,
  CircleDot,
  Filter,
  MessageCircleWarning,
  Plus,
  RefreshCw,
  Star,
  Ticket,
  X,
} from 'lucide-react';
import InboxSelect, { type InboxSelectOption } from './InboxSelect';
import SearchInput from '../ui/SearchInput';
import { useGlassTipProps } from './ComposerGlassTip';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import type { InboundHealth } from '../../hooks/useWebhookHealth';

const FILTERS_MENU_WIDTH = 280;
const FILTERS_MENU_GAP = 8;
const FILTERS_MENU_FALLBACK_HEIGHT = 360;

export type ListChip = 'all' | 'unread' | 'favourites' | 'unreplied' | 'hasTicket' | 'botActive';

const STATUS_CHIPS: Array<{
  value: string;
  label: string;
  color?: string;
}> = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open', color: 'bg-emerald-500' },
  { value: 'PENDING', label: 'Pending', color: 'bg-amber-500' },
  { value: 'CLOSED', label: 'Closed', color: 'bg-neutral-400' },
];

interface InboxListHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchInputRef?: Ref<HTMLInputElement>;
  chip: ListChip;
  onChipChange: (chip: ListChip) => void;
  conversationTotal: number;
  unreadTotal: number;
  statusFilter: string;
  agentFilter: string;
  onStatusFilterChange: (value: string) => void;
  onAgentFilterChange: (value: string) => void;
  agentOptions: InboxSelectOption[];
  agentOptionsSearchable: boolean;
  selectionMode: boolean;
  onCancelSelection: () => void;
  onNewChat: () => void;
  onRefresh: () => void;
  inboundHealth?: InboundHealth;
  onRetryHealth: () => void;
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

export default function InboxListHeader({
  search,
  onSearchChange,
  searchInputRef,
  chip,
  onChipChange,
  conversationTotal,
  unreadTotal,
  statusFilter,
  agentFilter,
  onStatusFilterChange,
  onAgentFilterChange,
  agentOptions,
  agentOptionsSearchable,
  selectionMode,
  onCancelSelection,
  onNewChat,
  onRefresh,
  inboundHealth = { state: 'unknown' as const },
  onRetryHealth,
}: InboxListHeaderProps) {
  const tipFor = useGlassTipProps();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersPos, setFiltersPos] = useState<{
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);
  const filtersBtnRef = useRef<HTMLButtonElement>(null);
  const filtersMenuRef = useRef<HTMLDivElement>(null);
  const { hasConnectedNumber, loading: numberLoading } = useWhatsAppNumber();

  const isConnected = hasConnectedNumber && !numberLoading;
  const unreadActive = chip === 'unread';
  const popoverFiltersActive =
    Boolean(agentFilter) ||
    chip === 'favourites' ||
    chip === 'unreplied' ||
    chip === 'hasTicket' ||
    chip === 'botActive';
  const anyFilterActive = unreadActive || Boolean(statusFilter) || popoverFiltersActive;

  const clearAllFilters = () => {
    onStatusFilterChange('');
    onAgentFilterChange('');
    onChipChange('all');
    setFiltersOpen(false);
  };

  useLayoutEffect(() => {
    if (!filtersOpen || !filtersBtnRef.current) {
      setFiltersPos(null);
      return;
    }
    const place = () => {
      const btn = filtersBtnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const menuH = filtersMenuRef.current?.offsetHeight ?? FILTERS_MENU_FALLBACK_HEIGHT;
      const spaceBelow = window.innerHeight - rect.bottom - FILTERS_MENU_GAP;
      const spaceAbove = rect.top - FILTERS_MENU_GAP;
      const flipUp = spaceBelow < menuH && spaceAbove > spaceBelow;
      const right = Math.min(
        Math.max(FILTERS_MENU_GAP, window.innerWidth - rect.right),
        Math.max(FILTERS_MENU_GAP, window.innerWidth - FILTERS_MENU_WIDTH - FILTERS_MENU_GAP)
      );
      if (flipUp) {
        setFiltersPos({
          bottom: Math.max(FILTERS_MENU_GAP, window.innerHeight - rect.top + FILTERS_MENU_GAP),
          right,
        });
      } else {
        setFiltersPos({ top: rect.bottom + FILTERS_MENU_GAP, right });
      }
    };
    place();
    const raf = window.requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [filtersOpen, agentFilter, chip]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      const inBtn = filtersBtnRef.current?.contains(target);
      const inMenu = filtersMenuRef.current?.contains(target);
      // react-select menus portal to body — don't close when interacting with them
      const inSelectMenu = (target as Element).closest?.('.inbox-select__menu-portal');
      if (!inBtn && !inMenu && !inSelectMenu) setFiltersOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFiltersOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [filtersOpen]);

  return (
    <div className="shrink-0 border-b border-neutral-100 px-4 pb-3 pt-4 dark:border-neutral-800/80">
      {inboundHealth?.state === 'unhealthy' && (
        <div
          role="alert"
          data-testid="inbound-health-banner"
          className="mb-3 flex items-start gap-2.5 rounded-xl border border-red-300/80 bg-red-50/95 px-3 py-2.5 text-red-900 shadow-[0_2px_8px_rgba(220,38,38,0.08)] dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div className="min-w-0 flex-1 text-[12px] leading-snug">
            <p className="font-bold">
              {isConnected
                ? 'Inbound messages are not arriving.'
                : 'WhatsApp is not connected.'}
            </p>
            <p className="mt-0.5 text-red-800/85 dark:text-red-200/85">
              {isConnected
                ? inboundHealth?.reason
                : 'Connect a WhatsApp number to start receiving messages.'}
            </p>
            {isConnected && (
              <p className="mt-1 text-[11px] font-medium text-red-700/85 dark:text-red-300/80">
                Outbound still works on localhost; the public tunnel or Meta webhook subscription is
                the usual cause.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onRetryHealth}
            className={`shrink-0 rounded-md border border-red-300/80 px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-red-700 transition hover:bg-red-100 dark:border-red-500/40 dark:text-red-200 dark:hover:bg-red-900/40 ${FOCUS_RING_CLASS}`}
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-bold tracking-tight text-theme-fg">Inbox</h2>
            <InboundStatusDot
              isConnected={isConnected}
              numberLoading={numberLoading}
              inboundHealth={inboundHealth}
            />
          </div>
          <p
            className="mt-0.5 min-h-[1.125rem] truncate whitespace-nowrap text-[12px] font-medium leading-[1.125rem] text-theme-muted"
            title={formatCountLine(conversationTotal, unreadTotal)}
          >
            {formatCountLine(conversationTotal, unreadTotal)}
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
          )}

          <button
            type="button"
            onClick={onNewChat}
            data-testid="inbox-new-chat"
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 px-3 text-[12.5px] font-bold text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)] transition hover:brightness-105 active:scale-[0.98] ${FOCUS_RING_CLASS}`}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.75} />
            New chat
          </button>
        </div>
      </div>

      <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800/80">
        <div className="flex items-center gap-2">
          <SearchInput
            ref={searchInputRef}
            value={search}
            onChange={onSearchChange}
            placeholder="Search by name or phone..."
            className="min-w-0 flex-1 [&_input]:!h-9 [&_input]:rounded-lg [&_input]:!bg-theme-surface [&_input]:!shadow-none"
          />
          <button
            type="button"
            onClick={() => onChipChange(unreadActive ? 'all' : 'unread')}
            aria-pressed={unreadActive}
            aria-label={unreadActive ? 'Show all chats' : 'Unread only'}
            {...tipFor(unreadActive ? 'Show all chats' : 'Unread only')}
            data-testid="inbox-unread-toggle"
            className={squareBtn(unreadActive)}
          >
            <CircleDot className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <div className="relative shrink-0">
            <button
              ref={filtersBtnRef}
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-haspopup="dialog"
              aria-label="Filters"
              {...tipFor('Filters')}
              data-testid="inbox-filter-toggle"
              className={squareBtn(filtersOpen || popoverFiltersActive)}
            >
              <Filter className="h-4 w-4" strokeWidth={2.25} />
            </button>
            {filtersOpen &&
              filtersPos &&
              createPortal(
                <div
                  ref={filtersMenuRef}
                  role="dialog"
                  aria-label="Inbox filters"
                  data-testid="inbox-filters-menu"
                  style={{
                    top: filtersPos.top,
                    bottom: filtersPos.bottom,
                    right: filtersPos.right,
                    width: FILTERS_MENU_WIDTH,
                  }}
                  className="fixed z-[80] space-y-3 rounded-2xl border border-theme-border bg-theme-surface p-3 shadow-panel"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">
                      Filters
                    </p>
                    {anyFilterActive && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        data-testid="inbox-clear-filters"
                        className={`text-[11px] font-semibold text-whatsapp-700 transition hover:underline dark:text-whatsapp-400 ${FOCUS_RING_CLASS}`}
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-theme-muted">
                      Agent
                    </label>
                    <InboxSelect
                      variant="filter"
                      value={agentFilter}
                      placeholder="All agents"
                      isSearchable={agentOptionsSearchable}
                      options={agentOptions}
                      ariaLabel="Filter by assigned agent"
                      className="min-w-0 w-full"
                      menuMinWidth={240}
                      onChange={(e) => onAgentFilterChange(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1 border-t border-theme-border/70 pt-2">
                    <p className="px-0.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-theme-muted">
                      More
                    </p>
                    <ExtraToggle
                      active={chip === 'favourites'}
                      icon={Star}
                      label="Favourites"
                      onClick={() => onChipChange(chip === 'favourites' ? 'all' : 'favourites')}
                    />
                    <ExtraToggle
                      active={chip === 'unreplied'}
                      icon={MessageCircleWarning}
                      label="Unreplied"
                      onClick={() => onChipChange(chip === 'unreplied' ? 'all' : 'unreplied')}
                    />
                    <ExtraToggle
                      active={chip === 'hasTicket'}
                      icon={Ticket}
                      label="Open ticket"
                      onClick={() => onChipChange(chip === 'hasTicket' ? 'all' : 'hasTicket')}
                    />
                    <ExtraToggle
                      active={chip === 'botActive'}
                      icon={Bot}
                      label="Bot active"
                      onClick={() => onChipChange(chip === 'botActive' ? 'all' : 'botActive')}
                    />
                  </div>
                </div>,
                document.body
              )}
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Filter by status"
          aria-live="polite"
          className="mt-2.5 flex items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {STATUS_CHIPS.map((item) => {
            const active = statusFilter === item.value;
            return (
              <button
                key={item.value || 'all'}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`inbox-status-chip-${item.value || 'all'}`}
                onClick={() => onStatusFilterChange(item.value)}
                className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-semibold transition ${FOCUS_RING_CLASS} ${
                  active
                    ? 'bg-whatsapp-600 text-white shadow-[0_1px_3px_rgba(37,211,102,0.3)] dark:bg-whatsapp-500 dark:text-white'
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
  type Tone = 'green' | 'pending' | 'red';
  let tone: Tone = 'pending';
  let label = 'WhatsApp inbound status unknown';

  if (numberLoading || inboundHealth.state === 'loading' || inboundHealth.state === 'unknown') {
    tone = 'pending';
    label =
      numberLoading || inboundHealth.state === 'loading'
        ? 'Checking WhatsApp inbound…'
        : 'WhatsApp inbound status unknown';
  } else if (!isConnected || inboundHealth.state === 'unhealthy') {
    tone = 'red';
    label =
      inboundHealth.state === 'unhealthy'
        ? inboundHealth.reason || 'WhatsApp inbound disconnected'
        : 'WhatsApp not connected';
  } else if (inboundHealth.state === 'ok') {
    tone = 'green';
    label = 'WhatsApp inbound connected';
  }

  const colorClass =
    tone === 'green'
      ? 'bg-emerald-500'
      : tone === 'red'
        ? 'bg-red-500'
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

function ExtraToggle({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Star;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold transition ${FOCUS_RING_CLASS} ${
        active
          ? 'bg-whatsapp-500/10 text-whatsapp-800 dark:text-whatsapp-300'
          : 'text-theme-fg hover:bg-theme-subtle'
      }`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${active ? 'text-whatsapp-600' : 'text-theme-muted'}`}
        strokeWidth={2.25}
      />
      {label}
      {active && (
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-whatsapp-600">
          On
        </span>
      )}
    </button>
  );
}
