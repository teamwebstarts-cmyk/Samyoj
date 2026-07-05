import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, LifeBuoy, RefreshCw } from 'lucide-react';
import ContactAvatar from '../components/inbox/ContactAvatar';
import TicketCard, {
  canResolve,
  isSlaBreached,
  type TicketItem,
} from '../components/tickets/TicketCard';
import TicketDetailPanel from '../components/tickets/TicketDetailPanel';
import { ticketPriorityLabel, ticketStatusFilterOptions, ticketStatusLabel } from '../components/tickets/ticketUi';
import AppButton from '../components/ui/AppButton';
import AppSelect from '../components/ui/AppSelect';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import LoadingState from '../components/ui/LoadingState';
import PageHeader from '../components/ui/PageHeader';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import ResponsiveDataView from '../components/ui/ResponsiveDataView';
import StatusBadge from '../components/ui/StatusBadge';
import { TableTextButton } from '../components/ui/TableActions';
import { ticketApi } from '../services/api';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { toastError, toastSuccess } from '../utils/toast';
import { readNumberCache, writeNumberCache } from '../utils/whatsappNumberCache';

const TICKETS_CACHE_KEY = 'tickets';

type TicketsNumberCache = {
  tickets: TicketItem[];
  status: string;
  search: string;
  detailTicket: TicketItem | null;
};

function formatSla(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [detailTicket, setDetailTicket] = useState<TicketItem | null>(null);
  const loadRef = useRef<() => void>(() => {});
  const ticketsSnapshotRef = useRef<TicketsNumberCache>({
    tickets: [],
    status: '',
    search: '',
    detailTicket: null,
  });

  ticketsSnapshotRef.current = { tickets, status, search, detailTicket };

  const load = useCallback(() => {
    setLoading(true);
    ticketApi
      .list(status ? { status } : undefined)
      .then((res) => {
        const next = res.data.data.tickets || [];
        setTickets(next);
        setDetailTicket((current) => {
          if (!current) return null;
          return next.find((ticket: TicketItem) => ticket.id === current.id) ?? null;
        });
      })
      .catch(() => toastError('Failed to load tickets'))
      .finally(() => setLoading(false));
  }, [status]);

  loadRef.current = load;

  useOnActiveNumberChange(({ numberId, previousNumberId, isInitial }) => {
    if (isInitial) return;
    if (previousNumberId) writeNumberCache(TICKETS_CACHE_KEY, previousNumberId, ticketsSnapshotRef.current);
    const cached = readNumberCache<TicketsNumberCache>(TICKETS_CACHE_KEY, numberId);
    if (cached) {
      setTickets(cached.tickets);
      setStatus(cached.status);
      setSearch(cached.search);
      setDetailTicket(cached.detailTicket);
      setLoading(false);
      return;
    }
    setDetailTicket(null);
    loadRef.current();
  });

  useEffect(() => {
    load();
  }, [load]);

  const resolveTicket = async (id: string) => {
    setResolvingId(id);
    try {
      await ticketApi.update(id, { status: 'RESOLVED' });
      toastSuccess('Ticket resolved');
      load();
    } catch {
      toastError('Update failed');
    } finally {
      setResolvingId(null);
    }
  };

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((ticket) => {
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
  }, [tickets, search]);

  const stats = useMemo(
    () => ({
      total: tickets.length,
      open: tickets.filter((t) => t.status === 'OPEN').length,
      breached: tickets.filter(isSlaBreached).length,
    }),
    [tickets]
  );

  const hasActiveFilters = Boolean(search || status);

  const emptyState = (
    <EmptyState
      icon={LifeBuoy}
      variant={hasActiveFilters ? 'filter' : 'default'}
      title={hasActiveFilters ? 'No tickets match your filters' : 'No tickets yet'}
      description={
        hasActiveFilters
          ? 'Try a different search word or status.'
          : 'Create a ticket from any chat to track customer issues with deadlines.'
      }
      steps={hasActiveFilters ? undefined : ['Open Inbox', 'Pick a conversation', 'Tap Create ticket']}
      action={
        !hasActiveFilters ? (
          <Link to="/inbox">
            <AppButton variant="secondary" icon={<Inbox size={16} />}>
              Open Inbox
            </AppButton>
          </Link>
        ) : undefined
      }
    />
  );

  const renderTable = () => (
    <DataTable
      headers={['Ticket', 'Priority', 'Status', 'Reply by', 'Owner', 'Chat', 'Actions']}
      serialNo={false}
      minTableWidth="min-w-[760px]"
      className="border-0 bg-transparent shadow-none"
    >
      {filteredTickets.map((ticket) => {
        const breached = isSlaBreached(ticket);
        const contactLabel = ticket.contact?.name || ticket.contact?.phone;

        return (
          <tr
            key={ticket.id}
            className={`group cursor-pointer border-t border-theme-border transition-colors ${
              breached
                ? 'bg-rose-50/50 dark:bg-rose-950/20'
                : 'hover:bg-theme-subtle/40'
            }`}
            onClick={() => setDetailTicket(ticket)}
          >
            <td className="min-w-[200px] px-5 py-3.5">
              <div className="flex items-center gap-3">
                {ticket.contact ? (
                  <ContactAvatar
                    name={ticket.contact.name || undefined}
                    phone={ticket.contact.phone}
                    size="sm"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="font-semibold text-theme-fg">{ticket.title}</p>
                  {contactLabel && (
                    <p className="truncate text-[11px] text-theme-muted">{contactLabel}</p>
                  )}
                  {ticket.category && (
                    <p className="mt-0.5 text-[11px] capitalize text-theme-secondary">
                      {ticket.category}
                    </p>
                  )}
                </div>
              </div>
            </td>
            <td className="whitespace-nowrap px-5 py-3.5">
              <StatusBadge status={ticket.priority} label={ticketPriorityLabel(ticket.priority)} />
            </td>
            <td className="whitespace-nowrap px-5 py-3.5">
              <StatusBadge status={ticket.status} label={ticketStatusLabel(ticket.status)} />
            </td>
            <td
              className={`whitespace-nowrap px-5 py-3.5 tabular-nums text-[12px] ${
                breached
                  ? 'font-semibold text-rose-600 dark:text-rose-400'
                  : 'text-theme-secondary'
              }`}
            >
              {formatSla(ticket.slaDueAt)}
            </td>
            <td className="px-5 py-3.5 text-theme-secondary">
              {ticket.assignedAgent?.name || (
                <span className="text-theme-muted">Unassigned</span>
              )}
            </td>
            <td className="whitespace-nowrap px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
              {ticket.conversation ? (
                <Link
                  to={`/inbox?conversation=${ticket.conversation.id}`}
                  className="text-[13px] font-medium text-sky-700 hover:underline dark:text-sky-400"
                >
                  Open chat
                </Link>
              ) : (
                <span className="text-theme-muted">—</span>
              )}
            </td>
            <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-end">
                {canResolve(ticket.status) ? (
                  <TableTextButton
                    variant="neutral"
                    onClick={() => void resolveTicket(ticket.id)}
                  >
                    {resolvingId === ticket.id ? 'Resolving…' : 'Resolve'}
                  </TableTextButton>
                ) : (
                  <span className="text-[12px] text-theme-muted">—</span>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </DataTable>
  );

  return (
    <PageShell>
      <PageHeader />

      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Support"
          badgeIcon={LifeBuoy}
          title="Tickets"
          description="Track support issues from your inbox chats and reply deadlines."
          accent="violet"
          stats={[
            { label: 'Total', value: stats.total },
            {
              label: 'Open',
              value: stats.open,
              tone: 'text-violet-700 dark:text-violet-300',
            },
            {
              label: 'Overdue',
              value: stats.breached,
              tone: 'text-rose-700 dark:text-rose-300',
            },
          ]}
        />

        <div className="inbox-shell overflow-hidden">
          <ListToolbar
            embedded
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search ticket, contact, or owner..."
            filters={
              <AppSelect
                className="w-full sm:w-[148px]"
                value={status}
                placeholder="All statuses"
                isSearchable={false}
                options={[...ticketStatusFilterOptions]}
                onChange={(e) => setStatus(e.target.value)}
                ariaLabel="Filter by status"
              />
            }
            actions={
              <AppButton variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={load}>
                Refresh
              </AppButton>
            }
          />

          {loading ? (
            <div className="p-6">
              <LoadingState label="Loading tickets…" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-4 sm:p-6">{emptyState}</div>
          ) : (
            <ResponsiveDataView
              items={filteredTickets}
              cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 lg:hidden"
              tableClassName="px-4 sm:px-5 pt-4 sm:pb-5"
              renderCard={(ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onResolve={(id) => void resolveTicket(id)}
                  formatSla={formatSla}
                  resolving={resolvingId === ticket.id}
                  onClick={() => setDetailTicket(ticket)}
                />
              )}
              renderTable={renderTable}
            />
          )}
        </div>
      </div>

      <TicketDetailPanel
        ticket={detailTicket}
        open={Boolean(detailTicket)}
        onClose={() => setDetailTicket(null)}
        onResolve={(id) => void resolveTicket(id)}
        resolving={detailTicket ? resolvingId === detailTicket.id : false}
        formatSla={formatSla}
      />
    </PageShell>
  );
}
