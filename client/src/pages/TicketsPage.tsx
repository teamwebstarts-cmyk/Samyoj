import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import TicketDetailPanel from '../components/tickets/TicketDetailPanel';
import TicketEmptyWorkspace from '../components/tickets/TicketEmptyWorkspace';
import TicketList from '../components/tickets/TicketList';
import {
  TICKET_STATUS_FILTER_OPTIONS,
  isOverdue,
  ticketMatchesChip,
  ticketMatchesChannelFilter,
  TICKET_CHANNEL_FILTER_OPTIONS,
  ticketUpdateToast,
  type TicketItem,
} from '../components/tickets/ticketUi';
import AppButton from '../components/ui/AppButton';
import AppSelect from '../components/ui/AppSelect';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import { SplitListSkeleton } from '../components/ui/ListLayoutSkeleton';
import TicketHero from '../components/tickets/TicketHero';
import PageShell from '../components/ui/PageShell';
import { ticketApi } from '../services/api';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { useSocket } from '../hooks/useSocket';
import { toastError, toastSuccess } from '../utils/toast';
import { readNumberCache, writeNumberCache } from '../utils/whatsappNumberCache';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { whatsappNotConnectedCopy } from '../utils/whatsappConnectionCopy';

const TICKETS_CACHE_KEY = 'tickets';

type TicketsNumberCache = {
  tickets: TicketItem[];
  status: string;
  search: string;
  detailTicket: TicketItem | null;
};

export default function TicketsPage() {
  const { activeNumber, resolved, hasConnectedNumber, disconnectedNumbers, loading: numbersLoading } = useWhatsAppNumber();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
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
      if (!ticketMatchesChannelFilter(ticket, channel)) return false;
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
  }, [tickets, search, status, channel]);

  const stats = useMemo(
    () => ({
      open: tickets.filter((ticket) => ticket.status === 'OPEN').length,
      resolved: tickets.filter(
        (ticket) => ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
      ).length,
      overdue: tickets.filter(isOverdue).length,
    }),
    [tickets]
  );

  const hasActiveFilters = Boolean(search || status || channel);

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
    const copy = whatsappNotConnectedCopy(disconnectedNumbers, {
      task: 'track Inbox chats that still need a reply',
    });
    return (
      <PageShell>
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={Settings2}
            title={copy.title}
            description={copy.description}
            steps={
              copy.disconnected
                ? ['Open Settings', 'Reconnect this WhatsApp number', 'Create a ticket from Inbox']
                : ['Open Settings', 'Connect your WhatsApp number', 'Create a ticket from Inbox']
            }
            action={
              <Link to="/settings?tab=whatsapp">
                <AppButton icon={<Settings2 size={16} />}>{copy.cta}</AppButton>
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
            { label: 'Resolved', value: stats.resolved, hint: 'Closed', tone: 'resolved' },
          ]}
        />

        <div className="inbox-shell overflow-hidden">
          <ListToolbar
            embedded
            compactMobile
            inlineDesktop
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name or phone..."
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <AppSelect
                  ariaLabel="Filter ticket status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  options={TICKET_STATUS_FILTER_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  placeholder="All tickets"
                />
                <AppSelect
                  ariaLabel="Filter by channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  options={TICKET_CHANNEL_FILTER_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  placeholder="All channels"
                />
              </div>
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
                      setChannel('');
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
