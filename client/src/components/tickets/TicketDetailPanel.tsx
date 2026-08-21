import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  MessageSquare,
  StickyNote,
  Tag,
  Ticket,
  User,
} from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import AppSelect from '../ui/AppSelect';
import PriorityBadge from '../ui/PriorityBadge';
import StatusBadge from '../ui/StatusBadge';
import SlideOver from '../ui/SlideOver';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import { teamApi } from '../../services/api';
import type { TeamAgent } from '../../types';
import {
  TICKET_PRIORITIES,
  canResolve,
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

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-theme-subtle">
        <Icon className="h-3.5 w-3.5 text-theme-muted" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-theme-muted">{label}</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
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

  const contactLabel = ticketContactLabel(ticket);
  const conversationId = ticketConversationId(ticket);
  const action = nextTicketAction(ticket.status);
  const created = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null;
  const descriptionNote = ticket.conversation?.internalNotes?.[0]?.content;

  const agentOptions = [
    { value: '', label: 'Unassigned' },
    ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
  ];
  if (ticket.assignedAgent && !agents.some((agent) => agent.id === ticket.assignedAgent?.id)) {
    agentOptions.push({ value: ticket.assignedAgent.id, label: ticket.assignedAgent.name });
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={ticket.title}
      subtitle={contactLabel}
      icon={Ticket}
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
        {/* Customer header */}
        <div className="flex items-center gap-3">
          {ticket.contact ? (
            <ContactAvatar
              name={ticket.contact.name || undefined}
              phone={ticket.contact.phone}
              size="md"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Ticket className="h-5 w-5" strokeWidth={2.25} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold text-theme-fg">{contactLabel}</p>
            {ticket.contact?.phone && ticket.contact?.name && (
              <p className="mt-0.5 text-[12px] text-theme-muted">{ticket.contact.phone}</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <StatusBadge status={ticket.status} label={ticketStatusLabel(ticket.status)} />
              <PriorityBadge priority={ticket.priority} />
            </div>
          </div>
        </div>

        {/* Description / private note */}
        <div>
          <div className="mb-2.5 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/40">
              <StickyNote className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" strokeWidth={2.25} />
            </div>
            <p className="text-[12px] font-bold text-theme-fg">Description</p>
            <span className="ml-auto text-[10px] font-medium text-theme-muted">Team only</span>
          </div>
          {descriptionNote ? (
            <div className="rounded-xl border border-theme-border bg-theme-surface p-3.5">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-theme-fg">
                {descriptionNote}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-theme-border/70 bg-theme-subtle/40 px-3 py-4 text-center">
              <p className="text-[12px] text-theme-muted">No description yet</p>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4 rounded-2xl border border-theme-border bg-theme-subtle/30 p-4">
          <DetailRow icon={User} label="Assigned to">
            <AppSelect
              ariaLabel="Assign teammate"
              value={ticket.assignedAgent?.id || ''}
              placeholder="Unassigned"
              isSearchable={agents.length > 6}
              disabled={updating}
              options={agentOptions}
              onChange={(e) =>
                void onUpdate(ticket.id, { assignedAgentId: e.target.value || null })
              }
            />
          </DetailRow>

          {ticket.category && (
            <DetailRow icon={Tag} label="Category">
              <p className="text-[13px] font-semibold capitalize text-theme-fg">{ticket.category}</p>
            </DetailRow>
          )}

          {created && (
            <DetailRow icon={CalendarClock} label="Created">
              <p className="text-[13px] text-theme-fg">{created}</p>
            </DetailRow>
          )}
        </div>

        {/* Priority */}
        <div>
          <p className="mb-2.5 text-[12px] font-bold text-theme-fg">Priority</p>
          <div
            role="group"
            aria-label="Ticket priority"
            className="grid grid-cols-2 gap-1 rounded-xl bg-theme-subtle/80 p-1 ring-1 ring-theme-border/70 sm:grid-cols-4"
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
                  {ticketPriorityLabel(priority.value)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-2">
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
          {(ticket.status === 'WAITING' || ticket.status === 'PENDING') && (
            <AppButton
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={updating}
              onClick={() => void onUpdate(ticket.id, { status: 'OPEN' })}
            >
              Mark as needs reply
            </AppButton>
          )}

          {conversationId && (
            <Link to={`/inbox?conversation=${conversationId}`} onClick={onClose} className="block">
              <AppButton variant="secondary" icon={<MessageSquare size={16} />} className="w-full">
                Open linked chat
              </AppButton>
            </Link>
          )}
        </div>
      </div>
    </SlideOver>
  );
}
