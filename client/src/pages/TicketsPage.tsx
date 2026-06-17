import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, RefreshCw } from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import AppSelect from '../components/ui/AppSelect';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import StatusBadge from '../components/ui/StatusBadge';
import { ticketApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  category?: string | null;
  slaDueAt?: string | null;
  updatedAt: string;
  contact?: { id: string; name?: string | null; phone: string } | null;
  conversation?: { id: string; status: string } | null;
  assignedAgent?: { id: string; name: string } | null;
}

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    ticketApi
      .list(status ? { status } : undefined)
      .then((res) => setTickets(res.data.data.tickets || []))
      .catch(() => toastError('Failed to load tickets'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [status]);

  const resolveTicket = async (id: string) => {
    try {
      await ticketApi.update(id, { status: 'RESOLVED' });
      toastSuccess('Ticket resolved');
      load();
    } catch {
      toastError('Update failed');
    }
  };

  const isSlaBreached = (ticket: Ticket) =>
    ticket.slaDueAt &&
    !['RESOLVED', 'CLOSED'].includes(ticket.status) &&
    new Date(ticket.slaDueAt) < new Date();

  return (
    <PageShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AppSelect
          className="w-44"
          value={status}
          options={statusOptions}
          onChange={(e) => setStatus(e.target.value)}
          ariaLabel="Filter by status"
        />
        <AppButton variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>
          Refresh
        </AppButton>
      </div>

      <PageHero
        badge="Support"
        badgeIcon={LifeBuoy}
        title="Tickets"
        description="Lightweight ticketing linked to inbox conversations with SLA tracking."
        accent="violet"
        stats={[
          { label: 'Open', value: tickets.filter((t) => t.status === 'OPEN').length, tone: 'text-violet-700' },
          {
            label: 'SLA breached',
            value: tickets.filter(isSlaBreached).length,
            tone: 'text-rose-700',
          },
        ]}
      />

      {loading ? (
        <LoadingState label="Loading tickets…" />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No tickets yet"
          description="Convert a chat to a ticket from the Inbox to track issues with SLA."
          action={
            <Link to="/inbox">
              <AppButton variant="secondary">Open Inbox</AppButton>
            </Link>
          }
        />
      ) : (
        <div className="dashboard-card overflow-hidden animate-fade-up-delay">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-theme-border bg-theme-subtle/50 text-[11px] font-bold uppercase tracking-wider text-theme-muted">
              <tr>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">SLA due</th>
                <th className="px-4 py-3">Chat</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className={isSlaBreached(ticket) ? 'bg-rose-50/50 dark:bg-rose-950/20' : 'hover:bg-theme-subtle/40'}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-theme-fg">{ticket.title}</p>
                    {ticket.contact && (
                      <p className="text-[11px] text-theme-muted">
                        {ticket.contact.name || ticket.contact.phone}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ticket.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ticket.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-theme-secondary">
                    {ticket.slaDueAt
                      ? new Date(ticket.slaDueAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {ticket.conversation ? (
                      <Link
                        to={`/inbox?conversation=${ticket.conversation.id}`}
                        className="text-sky-700 hover:underline dark:text-sky-400"
                      >
                        Open chat
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!['RESOLVED', 'CLOSED'].includes(ticket.status) && (
                      <AppButton size="sm" variant="secondary" onClick={() => void resolveTicket(ticket.id)}>
                        Resolve
                      </AppButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
