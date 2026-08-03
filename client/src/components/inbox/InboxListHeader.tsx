import { useEffect, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckSquare,
  Filter,
  LayoutGrid,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Star,
  CircleDot,
  Timer,
  X,
} from 'lucide-react';
import InboxSelect, { type InboxSelectOption } from './InboxSelect';
import SearchInput from '../ui/SearchInput';
import { useGlassTipProps } from './ComposerGlassTip';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import type { InboundHealth } from '../../hooks/useWebhookHealth';

const EXTRA_MENU_WIDTH = 220;
const EXTRA_MENU_GAP = 8;
const EXTRA_MENU_FALLBACK_HEIGHT = 180;

export type ListChip = 'all' | 'unread' | 'favourites';

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
  slaFilter: string;
  onStatusFilterChange: (value: string) => void;
  onAgentFilterChange: (value: string) => void;
  onSlaFilterChange: (value: string) => void;
  statusOptions: InboxSelectOption[];
  agentOptions: InboxSelectOption[];
  agentOptionsSearchable: boolean;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
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
  slaFilter,
  onStatusFilterChange,
  onAgentFilterChange,
  onSlaFilterChange,
  statusOptions,
  agentOptions,
  agentOptionsSearchable,
  selectionMode,
  onToggleSelectionMode,
  onNewChat,
  onRefresh,
  inboundHealth = { state: 'unknown' as const },
  onRetryHealth,
}: InboxListHeaderProps) {
  const tipFor = useGlassTipProps();
  const [filtersRowOpen, setFiltersRowOpen] = useState(true);
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraPos, setExtraPos] = useState<{ top?: number; bottom?: number; right: number } | null>(
    null
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const extraBtnRef = useRef<HTMLButtonElement>(null);
  const extraMenuRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { hasConnectedNumber, loading: numberLoading } = useWhatsAppNumber();

  const isConnected = hasConnectedNumber && !numberLoading;
  const statusOrAgentActive = Boolean(statusFilter || agentFilter);
  const extraActive = chip !== 'all' || Boolean(slaFilter);
  const anyFilterActive = statusOrAgentActive || extraActive;

  useEffect(() => {
    if (selectionMode) setMenuOpen(false);
  }, [selectionMode]);

  useLayoutEffect(() => {
    if (!extraOpen || !extraBtnRef.current) {
      setExtraPos(null);
      return;
    }
    const place = () => {
      const btn = extraBtnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const menuH = extraMenuRef.current?.offsetHeight ?? EXTRA_MENU_FALLBACK_HEIGHT;
      const spaceBelow = window.innerHeight - rect.bottom - EXTRA_MENU_GAP;
      const spaceAbove = rect.top - EXTRA_MENU_GAP;
      const flipUp = spaceBelow < menuH && spaceAbove > spaceBelow;
      const right = Math.min(
        Math.max(EXTRA_MENU_GAP, window.innerWidth - rect.right),
        Math.max(EXTRA_MENU_GAP, window.innerWidth - EXTRA_MENU_WIDTH - EXTRA_MENU_GAP)
      );
      if (flipUp) {
        setExtraPos({
          bottom: Math.max(EXTRA_MENU_GAP, window.innerHeight - rect.top + EXTRA_MENU_GAP),
          right,
        });
      } else {
        setExtraPos({ top: rect.bottom + EXTRA_MENU_GAP, right });
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
  }, [extraOpen]);

  useEffect(() => {
    if (!extraOpen && !menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (extraOpen) {
        const inBtn = extraBtnRef.current?.contains(target);
        const inMenu = extraMenuRef.current?.contains(target);
        if (!inBtn && !inMenu) setExtraOpen(false);
      }
      if (menuOpen && menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (extraOpen) setExtraOpen(false);
      if (menuOpen) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [extraOpen, menuOpen]);

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
      {/* Row 1 — title + counts + actions */}
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
          {/* Single text node + nowrap: never stack "0 / conversations / · 0 / unread" when the pane is tight. */}
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
              onClick={onToggleSelectionMode}
              aria-label="Cancel selection"
              {...tipFor('Cancel selection')}
              data-testid="inbox-cancel-selection"
              className={squareBtn()}
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          ) : (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-label="List options"
                {...tipFor('List options')}
                className={squareBtn(menuOpen)}
              >
                <LayoutGrid className="h-4 w-4" strokeWidth={2.25} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleSelectionMode();
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle ${FOCUS_RING_CLASS}`}
                  >
                    <CheckSquare className="h-4 w-4 text-theme-muted" />
                    Select chats
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onRefresh();
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle ${FOCUS_RING_CLASS}`}
                  >
                    <RefreshCw className="h-4 w-4 text-theme-muted" />
                    Refresh list
                  </button>
                </div>
              )}
            </div>
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

      {/* Sub-header divider — separates title/actions from search + filters */}
      <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800/80">
        {/* Row 2 — search + funnel */}
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
            onClick={() => setFiltersRowOpen((v) => !v)}
            aria-expanded={filtersRowOpen}
            aria-label="Toggle filters"
            {...tipFor('Toggle filters')}
            data-testid="inbox-filter-toggle"
            className={squareBtn(filtersRowOpen || anyFilterActive)}
          >
            <Filter className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        {/* Row 3 — status / agents / extra (compact closed controls; menus stay wide via portal) */}
        {filtersRowOpen && (
          <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto] items-center gap-2 overflow-x-hidden">
            <InboxSelect
              variant="filter"
              value={statusFilter}
              placeholder="All status"
              isSearchable={false}
              options={statusOptions}
              ariaLabel="Filter by chat status"
              className="min-w-0"
              menuMinWidth={168}
              onChange={(e) => onStatusFilterChange(e.target.value)}
            />
            <InboxSelect
              variant="filter"
              value={agentFilter}
              placeholder="All agents"
              isSearchable={agentOptionsSearchable}
              options={agentOptions}
              ariaLabel="Filter by assigned agent"
              className="min-w-0"
              menuMinWidth={220}
              onChange={(e) => onAgentFilterChange(e.target.value)}
            />
            <div className="relative shrink-0">
              <button
                ref={extraBtnRef}
                type="button"
                onClick={() => setExtraOpen((v) => !v)}
                aria-expanded={extraOpen}
                aria-haspopup="menu"
                aria-label="Extra filters"
                {...tipFor('Extra filters')}
                data-testid="inbox-extra-filters"
                className={squareBtn(extraOpen || extraActive)}
              >
                <SlidersHorizontal className="h-4 w-4" strokeWidth={2.25} />
              </button>
              {extraOpen &&
                extraPos &&
                createPortal(
                  <div
                    ref={extraMenuRef}
                    role="menu"
                    aria-label="Extra filters"
                    data-testid="inbox-extra-filters-menu"
                    style={{
                      top: extraPos.top,
                      bottom: extraPos.bottom,
                      right: extraPos.right,
                      width: EXTRA_MENU_WIDTH,
                    }}
                    className="fixed z-[80] space-y-1 rounded-2xl border border-theme-border bg-theme-surface p-2 shadow-panel"
                  >
                    <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wide text-theme-muted">
                      Extra filters
                    </p>
                    <ExtraToggle
                      active={chip === 'unread'}
                      icon={CircleDot}
                      label="Unread only"
                      onClick={() => onChipChange(chip === 'unread' ? 'all' : 'unread')}
                    />
                    <ExtraToggle
                      active={chip === 'favourites'}
                      icon={Star}
                      label="Favourites"
                      onClick={() => onChipChange(chip === 'favourites' ? 'all' : 'favourites')}
                    />
                    <ExtraToggle
                      active={slaFilter === 'breached'}
                      icon={Timer}
                      label="SLA breached"
                      onClick={() =>
                        onSlaFilterChange(slaFilter === 'breached' ? '' : 'breached')
                      }
                    />
                  </div>,
                  document.body
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact inbound signal next to the Inbox title — single dot, no chrome text. */
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

  // Pending until number + health are known — never flash red/"error" on first paint.
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
