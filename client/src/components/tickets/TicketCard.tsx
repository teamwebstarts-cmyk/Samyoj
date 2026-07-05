import { CheckCircle2, MessageSquare, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import StatusBadge from '../ui/StatusBadge';
import { ticketPriorityLabel, ticketStatusLabel } from './ticketUi';

export interface TicketItem {
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

export function isSlaBreached(ticket: TicketItem) {
  return Boolean(
    ticket.slaDueAt &&
      !['RESOLVED', 'CLOSED'].includes(ticket.status) &&
      new Date(ticket.slaDueAt) < new Date()
  );
}

export function canResolve(status: string) {
  return !['RESOLVED', 'CLOSED'].includes(status);
}

interface TicketCardProps {
  ticket: TicketItem;
  onResolve: (id: string) => void;
  formatSla: (value?: string | null) => string;
  resolving?: boolean;
  onClick?: () => void;
}

export default function TicketCard({
  ticket,
  onResolve,
  formatSla,
  resolving,
  onClick,
}: TicketCardProps) {
  const breached = isSlaBreached(ticket);
  const contactLabel = ticket.contact?.name || ticket.contact?.phone;

  return (
    <article
      className={`bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50 ${
        breached ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
      >
        {ticket.contact ? (
          <ContactAvatar
            name={ticket.contact.name || undefined}
            phone={ticket.contact.phone}
            size="md"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
            <User className="h-4 w-4" strokeWidth={2.25} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-theme-fg">{ticket.title}</p>
          {contactLabel && (
            <p className="mt-0.5 truncate text-[11px] text-theme-secondary">{contactLabel}</p>
          )}
          {ticket.category && (
            <p className="mt-0.5 text-[11px] capitalize text-theme-muted">{ticket.category}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.priority} label={ticketPriorityLabel(ticket.priority)} />
            <StatusBadge status={ticket.status} label={ticketStatusLabel(ticket.status)} />
          </div>
          <p
            className={`mt-2 text-[11px] ${
              breached ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-theme-muted'
            }`}
          >
            Reply by {formatSla(ticket.slaDueAt)}
            {breached ? ' · Overdue' : ''}
          </p>
          <p className="mt-1 text-[11px] font-medium text-theme-secondary">
            {ticket.assignedAgent?.name || 'Unassigned'}
          </p>
        </div>
      </button>

      {(ticket.conversation || canResolve(ticket.status)) && (
        <div className="flex gap-2 border-t border-theme-border/60 bg-theme-subtle/20 px-3 py-2.5">
          {ticket.conversation && (
            <Link
              to={`/inbox?conversation=${ticket.conversation.id}`}
              className={canResolve(ticket.status) ? 'flex-1' : 'w-full'}
              onClick={(e) => e.stopPropagation()}
            >
              <AppButton variant="secondary" size="sm" fullWidth icon={<MessageSquare size={14} />}>
                Open chat
              </AppButton>
            </Link>
          )}
          {canResolve(ticket.status) && (
            <AppButton
              variant="secondary"
              size="sm"
              fullWidth
              className={ticket.conversation ? 'flex-1' : 'w-full'}
              loading={resolving}
              icon={<CheckCircle2 size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                onResolve(ticket.id);
              }}
            >
              Resolve
            </AppButton>
          )}
        </div>
      )}
    </article>
  );
}
