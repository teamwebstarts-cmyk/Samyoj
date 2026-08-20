import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RefreshCw, Settings2 } from 'lucide-react';
import TicketDetailPanel from '../components/tickets/TicketDetailPanel';
import TicketEmptyWorkspace from '../components/tickets/TicketEmptyWorkspace';
import TicketList from '../components/tickets/TicketList';
import {
  TICKET_STATUS_CHIPS,
  isSlaBreached,
  ticketMatchesChip,
  ticketUpdateToast,
  type TicketItem,
} from '../components/tickets/ticketUi';
import AppButton from '../components/ui/AppButton';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import { SplitListSkeleton } from '../components/ui/ListLayoutSkeleton';
import TicketHero from '../components/tickets/TicketHero';
import PageShell from '../components/ui/PageShell';
import { FOCUS_RING_CLASS } from '../hooks/inboxA11y';
import { ticketApi } from '../services/api';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { useSocket } from '../hooks/useSocket';
import { toastError, toastSuccess } from '../utils/toast';
import { readNumberCache, writeNumberCache } from '../utils/whatsappNumberCache';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';

const TICKETS_CACHE_KEY = 'tickets';

type TicketsNumberCache = {
  tickets: TicketItem[];
  status: string;
  search: string;
  detailTicket: TicketItem | null;
};

export default function TicketsPage() {
  const { activeNumber, resolved, hasConnectedNumber, loading: numbersLoading } = useWhatsAppNumber();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [detailTicket, setDetailTicket] = useState<TicketItem | null>(null);
  const loadRef = useRef<() => void>(() => {});
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const ticketsSnapshotRef = useRef<TicketsNumberCache>({
    tickets: [],
    status: '',
    search: '',
    detailTicket: null,
  });

  ticketsSnapshotRef.current = { tickets, status, search, detailTicket };

  const load = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    setLoading(true);
    ticketApi
      .list()
      .then((res) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const next = (res.data.data.tickets || []) as TicketItem[];
        setTickets(next);
        setDetailTicket((current) => {
          if (!current) return null;
          return next.find((ticket) => ticket.id === current.id) ?? null;
        });
      })
      .catch(() => toastError('Failed to load tickets'))
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setLoading(false);
      });
  }, [activeNumber, resolved]);

  loadRef.current = load;

  useOnActiveNumberChange(({ numberId, previousNumberId, isInitial }) => {
    if (isInitial) return;
    if (previousNumberId) writeNumberCache(TICKETS_CACHE_KEY, previousNumberId, ticketsSnapshotRef.current);
    const cached = readNumberCache<TicketsNumberCache>(TICKETS_CACHE_KEY, numberId);
    if (cached) {
      setTickets(cached.tickets);
      setStatus(cached.status);
      setSearch(cached.search);
      setDetailTicket(null);
      setUpdatingId(null);
      setLoading(true);
      loadRef.current();
      return;
    }
    setTickets([]);
    setStatus('');
    setSearch('');
    setDetailTicket(null);
    loadRef.current();
  });

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ticketId = searchParams.get('ticket');
    if (!ticketId || loading) return;
    const found = tickets.find((ticket) => ticket.id === ticketId);
    if (found) {
      setStatus('');
      setSearch('');
      setDetailTicket(found);
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, tickets, loading]);

  useSocket((event, data) => {
    if (event !== 'ticket:new' && event !== 'ticket:updated') return;
    const payload = data as { whatsappNumberId?: string | null };
    const currentNumberId = activeNumberIdRef.current;
    if (payload.whatsappNumberId && currentNumberId && payload.whatsappNumberId !== currentNumberId) {
      return;
    }
    loadRef.current();
  });

  const updateTicket = async (id: string, data: Record<string, unknown>) => {
    setUpdatingId(id);
    try {
      const res = await ticketApi.update(id, data);
      const updated = res.data.data as TicketItem;
      toastSuccess(ticketUpdateToast(data));
      setTickets((prev) => prev.map((ticket) => (ticket.id === id ? { ...ticket, ...updated } : ticket)));
      setDetailTicket((current) => (current?.id === id ? { ...current, ...updated } : current));
    } catch {
      toastError('Update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (!ticketMatchesChip(ticket, status)) return false;
      if (!q) return true;
      const contact = ticket.contact?.name || ticket.contact?.phone || '';
      const owner = ticket.assignedAgent?.name || '';
      const category = ticket.category || '';
      return (
        ticket.title.toLowerCase().includes(q) ||
        contact.toLowerCase().includes(q) ||
        owner.toLowerCase().includes(q) ||
        category.toLowerCase().includes(q)
      );
    });
  }, [tickets, search, status]);

  const stats = useMemo(
    () => ({
      open: tickets.filter((ticket) => ticket.status === 'OPEN').length,
      overdue: tickets.filter(isSlaBreached).length,
      waiting: tickets.filter((ticket) => ticket.status === 'WAITING' || ticket.status === 'PENDING').length,
    }),
    [tickets]
  );

  const hasActiveFilters = Boolean(search || status);
  const showOverdueBanner = stats.overdue > 0 && status !== 'overdue';

  if (numbersLoading || !resolved) {
    return (
      <PageShell>
        <div className="space-y-4 p-4 sm:p-6">
          <SplitListSkeleton label="Loading tickets" />
        </div>
      </PageShell>
    );
  }

  if (!hasConnectedNumber) {
    return (
      <PageShell>
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={Settings2}
            title="Connect WhatsApp first"
            description="Tickets track Inbox chats that still need a reply. Connect WhatsApp before creating them."
            steps={['Open Settings', 'Connect your WhatsApp number', 'Create a ticket from Inbox']}
            action={
              <Link to="/settings">
                <AppButton icon={<Settings2 size={16} />}>Go to Settings</AppButton>
              </Link>
            }
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="space-y-4 sm:space-y-5">
        <TicketHero
          stats={[
            { label: 'Total', value: tickets.length, hint: 'All tickets', tone: 'total' },
            { label: 'Open', value: stats.open, hint: 'Needs action', tone: 'open' },
            { label: 'Overdue', value: stats.overdue, hint: 'Past SLA', tone: 'overdue' },
            { label: 'Waiting', value: stats.waiting, hint: 'Pending reply', tone: 'waiting' },
          ]}
        />

        {showOverdueBanner && (
          <div className="flex flex-col gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-rose-500/20 dark:bg-rose-950/20">
            <div>
              <p className="text-[13px] font-bold text-rose-900 dark:text-rose-200">
                {stats.overdue} ticket{stats.overdue === 1 ? '' : 's'} past the reply deadline
              </p>
              <p className="mt-0.5 text-[12px] text-rose-800/80 dark:text-rose-300/80">
                Open the chat and reply, then mark the ticket resolved.
              </p>
            </div>
            <AppButton
              variant="secondary"
              size="sm"
              className="w-full shrink-0 sm:w-auto"
              onClick={() => setStatus('overdue')}
            >
              View overdue
            </AppButton>
          </div>
        )}

        <div className="inbox-shell overflow-hidden">
          <ListToolbar
            embedded
            compactMobile
            stackFilters
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name or phone..."
            filters={
              <div
                className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Ticket status"
              >
                {TICKET_STATUS_CHIPS.map((chip) => {
                  const active = status === chip.value;
                  return (
                    <button
                      key={chip.value || 'all'}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setStatus(chip.value)}
                      className={`inline-flex h-8 shrink-0 items-center rounded-lg px-2.5 text-[12px] font-semibold transition ${FOCUS_RING_CLASS} ${
                        active
                          ? 'bg-whatsapp-600 text-white shadow-[0_1px_3px_rgba(37,211,102,0.3)]'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            }
            actions={
              <AppButton variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={load}>
                Refresh
              </AppButton>
            }
          />

          {loading && tickets.length === 0 ? (
            <SplitListSkeleton label="Loading tickets" />
          ) : filteredTickets.length === 0 ? (
            <TicketEmptyWorkspace
              mode={hasActiveFilters ? 'filter' : 'empty'}
              onClearFilters={
                hasActiveFilters
                  ? () => {
                      setSearch('');
                      setStatus('');
                    }
                  : undefined
              }
            />
          ) : (
            <TicketList
              tickets={filteredTickets}
              onOpen={setDetailTicket}
              onUpdateStatus={(id, nextStatus) => void updateTicket(id, { status: nextStatus })}
              updatingId={updatingId}
            />
          )}
        </div>
      </div>

      <TicketDetailPanel
        ticket={detailTicket}
        open={Boolean(detailTicket)}
        onClose={() => setDetailTicket(null)}
        onUpdate={updateTicket}
        updating={detailTicket ? updatingId === detailTicket.id : false}
      />
    </PageShell>
  );
}
