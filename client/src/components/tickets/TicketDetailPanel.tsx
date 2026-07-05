import { Link } from 'react-router-dom';
import { Clock, Inbox, LifeBuoy, User } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import StatusBadge from '../ui/StatusBadge';
import SlideOver from '../ui/SlideOver';
import { canResolve, isSlaBreached, type TicketItem } from './TicketCard';
import { ticketPriorityLabel, ticketStatusLabel } from './ticketUi';

interface TicketDetailPanelProps {
  ticket: TicketItem | null;
  open: boolean;
  onClose: () => void;
  onResolve: (id: string) => void;
  resolving?: boolean;
  formatSla: (value?: string | null) => string;
}

export default function TicketDetailPanel({
  ticket,
  open,
  onClose,
  onResolve,
  resolving,
  formatSla,
}: TicketDetailPanelProps) {
  if (!ticket) return null;

  const breached = isSlaBreached(ticket);
  const contactLabel = ticket.contact?.name || ticket.contact?.phone;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={ticket.title}
      subtitle={contactLabel || 'Support ticket'}
      icon={LifeBuoy}
      accent="violet"
      footer={
        <div className="flex w-full gap-2">
          <AppButton variant="secondary" size="sm" onClick={onClose} className="flex-1">
            Close
          </AppButton>
          {canResolve(ticket.status) && (
            <AppButton
              size="sm"
              loading={resolving}
              onClick={() => onResolve(ticket.id)}
              className="flex-1"
            >
              Resolve ticket
            </AppButton>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          {ticket.contact ? (
            <ContactAvatar
              name={ticket.contact.name || undefined}
              phone={ticket.contact.phone}
              size="md"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
              <LifeBuoy className="h-4 w-4" strokeWidth={2.25} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-theme-fg">{contactLabel || 'Unknown contact'}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <StatusBadge status={ticket.priority} label={ticketPriorityLabel(ticket.priority)} />
              <StatusBadge status={ticket.status} label={ticketStatusLabel(ticket.status)} />
            </div>
          </div>
        </div>

        <dl className="space-y-3 rounded-2xl border border-theme-border bg-theme-subtle/30 p-4">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-theme-muted" />
            <div>
              <dt className="text-caption font-bold uppercase text-theme-muted">Reply by</dt>
              <dd
                className={`text-[13px] font-semibold ${
                  breached ? 'text-rose-600 dark:text-rose-400' : 'text-theme-fg'
                }`}
              >
                {formatSla(ticket.slaDueAt)}
                {breached && ' · Overdue'}
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-theme-muted" />
            <div>
              <dt className="text-caption font-bold uppercase text-theme-muted">Assigned to</dt>
              <dd className="text-[13px] font-semibold text-theme-fg">
                {ticket.assignedAgent?.name || (
                  <span className="font-medium text-theme-muted">Unassigned</span>
                )}
              </dd>
            </div>
          </div>

          {ticket.category && (
            <div>
              <dt className="text-caption font-bold uppercase text-theme-muted">Category</dt>
              <dd className="mt-0.5 text-[13px] capitalize text-theme-fg">{ticket.category}</dd>
            </div>
          )}
        </dl>

        {ticket.conversation && (
          <Link to={`/inbox?conversation=${ticket.conversation.id}`} onClick={onClose}>
            <AppButton variant="secondary" icon={<Inbox size={16} />} className="w-full">
              Open linked chat
            </AppButton>
          </Link>
        )}
      </div>
    </SlideOver>
  );
}
