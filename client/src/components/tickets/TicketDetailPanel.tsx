import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Inbox, LifeBuoy, User } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import AppSelect from '../ui/AppSelect';
import StatusBadge from '../ui/StatusBadge';
import SlideOver from '../ui/SlideOver';
import { ModalSection } from '../ui/modalUi';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import { teamApi } from '../../services/api';
import type { TeamAgent } from '../../types';
import {
  TICKET_PRIORITIES,
  canResolve,
  formatReplyBy,
  isSlaBreached,
  nextTicketAction,
  ticketContactLabel,
  ticketConversationId,
  ticketPriorityLabel,
  ticketStatusLabel,
  type TicketItem,
} from './ticketUi';

interface TicketDetailPanelProps {
  ticket: TicketItem | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void> | void;
  updating?: boolean;
}

export default function TicketDetailPanel({
  ticket,
  open,
  onClose,
  onUpdate,
  updating,
}: TicketDetailPanelProps) {
  const [agents, setAgents] = useState<TeamAgent[]>([]);

  useEffect(() => {
    if (!open) return;
    teamApi
      .agents()
      .then(({ data }) => setAgents((data.data?.agents as TeamAgent[]) || []))
      .catch(() => setAgents([]));
  }, [open]);

  if (!ticket) return null;

  const breached = isSlaBreached(ticket);
  const contactLabel = ticketContactLabel(ticket);
  const conversationId = ticketConversationId(ticket);
  const reply = formatReplyBy(ticket.slaDueAt);
  const action = nextTicketAction(ticket.status);
  const created = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={ticket.title}
      subtitle={contactLabel}
      icon={LifeBuoy}
      accent="emerald"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <AppButton variant="secondary" size="sm" onClick={onClose} className="sm:flex-1">
            Close
          </AppButton>
          {action && (
            <AppButton
              size="sm"
              loading={updating}
              onClick={() => void onUpdate(ticket.id, { status: action.next })}
              className="sm:flex-1"
            >
              {action.label}
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
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <LifeBuoy className="h-4 w-4" strokeWidth={2.25} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold text-theme-fg">{contactLabel}</p>
            {ticket.contact?.phone && ticket.contact?.name && (
              <p className="mt-0.5 text-[12px] text-theme-muted">{ticket.contact.phone}</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-2">
              <StatusBadge status={ticket.status} label={ticketStatusLabel(ticket.status)} />
              <StatusBadge status={ticket.priority} label={ticketPriorityLabel(ticket.priority)} />
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
                  reply.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-theme-fg'
                }`}
              >
                {reply.text}
                {breached ? ' · Overdue' : ''}
              </dd>
              {reply.exact && (
                <p className="mt-0.5 text-[12px] text-theme-muted">{reply.exact}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-theme-muted" />
            <div className="min-w-0 flex-1">
              <dt className="text-caption font-bold uppercase text-theme-muted">Assigned to</dt>
              <dd className="mt-1.5">
                <AppSelect
                  ariaLabel="Assign teammate"
                  value={ticket.assignedAgent?.id || ''}
                  placeholder="Unassigned"
                  isSearchable={agents.length > 6}
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
                  ]}
                  onChange={(e) =>
                    void onUpdate(ticket.id, { assignedAgentId: e.target.value || null })
                  }
                />
              </dd>
            </div>
          </div>

          {ticket.category && (
            <div>
              <dt className="text-caption font-bold uppercase text-theme-muted">Category</dt>
              <dd className="mt-0.5 text-[13px] capitalize text-theme-fg">{ticket.category}</dd>
            </div>
          )}

          {created && (
            <div>
              <dt className="text-caption font-bold uppercase text-theme-muted">Created</dt>
              <dd className="mt-0.5 text-[13px] text-theme-fg">{created}</dd>
            </div>
          )}
        </dl>

        <ModalSection title="Priority" subtitle="Urgent tickets should be answered first.">
          <div
            role="group"
            aria-label="Ticket priority"
            className="grid grid-cols-4 gap-1 rounded-xl bg-theme-subtle/80 p-1 ring-1 ring-theme-border/70"
          >
            {TICKET_PRIORITIES.map((priority) => {
              const selected = ticket.priority === priority.value;
              return (
                <button
                  key={priority.value}
                  type="button"
                  aria-pressed={selected}
                  disabled={updating}
                  onClick={() => {
                    if (!selected) void onUpdate(ticket.id, { priority: priority.value });
                  }}
                  className={`rounded-lg px-1.5 py-2 text-[12px] font-bold transition ${FOCUS_RING_CLASS} ${
                    selected
                      ? 'bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_2px_8px_rgba(37,211,102,0.28)]'
                      : 'text-theme-secondary hover:bg-theme-surface/80 hover:text-theme-fg'
                  }`}
                >
                  {priority.label}
                </button>
              );
            })}
          </div>
        </ModalSection>

        {canResolve(ticket.status) && ticket.status !== 'WAITING' && (
          <AppButton
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={updating}
            onClick={() => void onUpdate(ticket.id, { status: 'WAITING' })}
          >
            Waiting on the customer
          </AppButton>
        )}

        {conversationId && (
          <Link to={`/inbox?conversation=${conversationId}`} onClick={onClose}>
            <AppButton variant="secondary" icon={<Inbox size={16} />} className="w-full">
              Open linked chat
            </AppButton>
          </Link>
        )}
      </div>
    </SlideOver>
  );
}
