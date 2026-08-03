import { useEffect, useRef, useState, type Ref } from 'react';
import { CheckSquare, ListFilter, MessageSquarePlus, MoreVertical, Plus, RefreshCw } from 'lucide-react';
import WhatsAppLogo from './WhatsAppLogo';
import InboxSelect, { type InboxSelectOption } from './InboxSelect';
import SearchInput from '../ui/SearchInput';
import ConnectionStatusIndicator from '../ui/ConnectionStatusIndicator';
import type { SocketState } from '../../hooks/useSocket';

export type ListChip = 'all' | 'unread' | 'favourites' | 'sla';

interface InboxListHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchInputRef?: Ref<HTMLInputElement>;
  chip: ListChip;
  onChipChange: (chip: ListChip) => void;
  unreadTotal: number;
  statusFilter: string;
  agentFilter: string;
  onStatusFilterChange: (value: string) => void;
  onAgentFilterChange: (value: string) => void;
  statusOptions: InboxSelectOption[];
  agentOptions: InboxSelectOption[];
  agentOptionsSearchable: boolean;
  socketState: SocketState;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  onNewChat: () => void;
  onRefresh: () => void;
}

export default function InboxListHeader({
  search,
  onSearchChange,
  searchInputRef,
  chip,
  onChipChange,
  unreadTotal,
  statusFilter,
  agentFilter,
  onStatusFilterChange,
  onAgentFilterChange,
  statusOptions,
  agentOptions,
  agentOptionsSearchable,
  socketState,
  selectionMode,
  onToggleSelectionMode,
  onNewChat,
  onRefresh,
}: InboxListHeaderProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const advancedActive = Boolean(statusFilter || agentFilter);

  useEffect(() => {
    if (!filtersOpen && !menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [filtersOpen, menuOpen]);

  return (
    <div className="shrink-0 border-b border-neutral-100 px-4 pb-3 pt-4 dark:border-neutral-800/80">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-whatsapp-400 to-whatsapp-600 text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)]">
            <WhatsAppLogo size={20} />
          </div>
          <h2 className="text-[18px] font-bold tracking-tight text-theme-fg">Chats</h2>
        </div>

        <div className="flex items-center gap-1.5">
          <ConnectionStatusIndicator
            status={socketState.status}
            reconnectAttempts={socketState.reconnectAttempts}
            totalDisconnects={socketState.totalDisconnects}
          />
          <div className="relative" ref={filtersRef}>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition ${
                advancedActive
                  ? 'border-whatsapp-500/50 bg-whatsapp-500/10 text-whatsapp-700 dark:text-whatsapp-400'
                  : 'border-theme-border bg-theme-surface text-theme-secondary hover:bg-theme-subtle'
              }`}
            >
              <ListFilter className="h-3.5 w-3.5" strokeWidth={2.25} />
              Filters
              {advancedActive && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-whatsapp-500 px-1 text-[9px] font-bold text-white">
                  {(statusFilter ? 1 : 0) + (agentFilter ? 1 : 0)}
                </span>
              )}
            </button>
            {filtersOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 w-[260px] space-y-2 rounded-2xl border border-theme-border bg-theme-surface p-3 shadow-panel">
                <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">
                  Refine chat list
                </p>
                <InboxSelect
                  variant="filter"
                  value={statusFilter}
                  placeholder="All chats"
                  isSearchable={false}
                  options={statusOptions}
                  ariaLabel="Filter by chat status"
                  onChange={(e) => onStatusFilterChange(e.target.value)}
                />
                <InboxSelect
                  variant="filter"
                  value={agentFilter}
                  placeholder="All agents"
                  isSearchable={agentOptionsSearchable}
                  options={agentOptions}
                  ariaLabel="Filter by assigned agent"
                  onChange={(e) => onAgentFilterChange(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Chat list options"
              className="flex h-9 w-9 items-center justify-center rounded-full text-theme-secondary transition hover:bg-theme-subtle"
            >
              <MoreVertical className="h-4 w-4" strokeWidth={2.25} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onNewChat();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle"
                >
                  <MessageSquarePlus className="h-4 w-4 text-whatsapp-600" />
                  New chat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleSelectionMode();
                  }}
                  aria-pressed={selectionMode}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle"
                >
                  <CheckSquare
                    className={`h-4 w-4 ${selectionMode ? 'text-whatsapp-600' : 'text-theme-muted'}`}
                  />
                  {selectionMode ? 'Exit select mode' : 'Select chats'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onRefresh();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle"
                >
                  <RefreshCw className="h-4 w-4 text-theme-muted" />
                  Refresh list
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <SearchInput
        ref={searchInputRef}
        value={search}
        onChange={onSearchChange}
        placeholder="Search conversations"
        className="[&_input]:!h-10 [&_input]:rounded-lg [&_input]:!bg-theme-subtle/70 [&_input]:!shadow-none"
      />

      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => onChipChange('all')}
          aria-pressed={chip === 'all'}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
            chip === 'all'
              ? 'bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)]'
              : 'bg-theme-subtle text-theme-secondary hover:text-theme-fg'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => onChipChange('unread')}
          aria-pressed={chip === 'unread'}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
            chip === 'unread'
              ? 'bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)]'
              : 'bg-theme-subtle text-theme-secondary hover:text-theme-fg'
          }`}
        >
          Unread{unreadTotal > 0 ? ` ${unreadTotal}` : ''}
        </button>
        <button
          type="button"
          onClick={() => onChipChange('favourites')}
          aria-pressed={chip === 'favourites'}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
            chip === 'favourites'
              ? 'bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)]'
              : 'bg-theme-subtle text-theme-secondary hover:text-theme-fg'
          }`}
        >
          Favourites
        </button>
        <button
          type="button"
          onClick={() => onChipChange('sla')}
          aria-pressed={chip === 'sla'}
          title="Conversations past their first-response SLA"
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
            chip === 'sla'
              ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-[0_2px_8px_rgba(239,68,68,0.35)]'
              : 'bg-theme-subtle text-theme-secondary hover:text-theme-fg'
          }`}
        >
          SLA
        </button>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          title="Add a filter"
          aria-label="Add a filter"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
            advancedActive
              ? 'border-whatsapp-500/50 text-whatsapp-600'
              : 'border-theme-border text-theme-muted hover:border-whatsapp-500/40 hover:text-whatsapp-600'
          }`}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
