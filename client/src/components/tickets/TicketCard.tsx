import { CheckCircle2, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import PriorityBadge from '../ui/PriorityBadge';
import StatusBadge from '../ui/StatusBadge';
import {
  canResolve,
  isSlaBreached,
  nextTicketAction,
  ticketContactLabel,
  ticketConversationId,
  ticketStatusLabel,
  type TicketItem,
} from './ticketUi';

interface TicketCardProps {
  ticket: TicketItem;
  onUpdateStatus?: (id: string, status: string) => void;
  updating?: boolean;
  onClick?: () => void;
}

export default function TicketCard({ ticket, onUpdateStatus, updating, onClick }: TicketCardProps) {
  const breached = isSlaBreached(ticket);
  const contactLabel = ticketContactLabel(ticket);
  const conversationId = ticketConversationId(ticket);
  const action = nextTicketAction(ticket.status);

  return (
    <article
      className={`bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50 ${
        breached ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
      }`}
    >
      <button type="button" onClick={onClick} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        {ticket.contact ? (
          <ContactAvatar
            name={ticket.contact.name || undefined}
            phone={ticket.contact.phone}
            size="md"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <MessageSquare className="h-4 w-4" strokeWidth={2.25} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-theme-fg">{contactLabel}</p>
          <p className="mt-0.5 truncate text-[12px] text-theme-secondary">{ticket.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={ticket.status} label={ticketStatusLabel(ticket.status)} />
            <PriorityBadge priority={ticket.priority} />
            {ticket.assignedAgent?.name ? (
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-neutral-600 ring-1 ring-inset ring-neutral-200/70 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700/70">
                {ticket.assignedAgent.name}
              </span>
            ) : (
              <span className="text-[11px] font-medium text-theme-muted">Unassigned</span>
            )}
          </div>
        </div>
      </button>

      {(conversationId || action) && (
        <div className="flex flex-col gap-2 border-t border-theme-border/60 bg-theme-subtle/20 px-3 py-2.5 min-[400px]:flex-row">
          {conversationId && (
            <Link
              to={`/inbox?conversation=${conversationId}`}
              className={action ? 'min-[400px]:flex-1' : 'w-full'}
              onClick={(e) => e.stopPropagation()}
            >
              <AppButton variant="secondary" size="sm" fullWidth icon={<MessageSquare size={14} />}>
                Open chat
              </AppButton>
            </Link>
          )}
          {action && (
            <AppButton
              variant="secondary"
              size="sm"
              fullWidth
              className={conversationId ? 'min-[400px]:flex-1' : 'w-full'}
              loading={updating}
              icon={canResolve(ticket.status) ? <CheckCircle2 size={14} /> : undefined}
              onClick={(e) => {
                e.stopPropagation();
                onUpdateStatus?.(ticket.id, action.next);
              }}
            >
              {action.label}
            </AppButton>
          )}
        </div>
      )}
    </article>
  );
}
