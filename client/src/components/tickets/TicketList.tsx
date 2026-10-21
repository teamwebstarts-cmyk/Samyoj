import ContactAvatar from '../inbox/ContactAvatar';
import DataTable from '../ui/DataTable';
import PriorityBadge from '../ui/PriorityBadge';
import ResponsiveDataView from '../ui/ResponsiveDataView';
import StatusBadge from '../ui/StatusBadge';
import { TableTextButton } from '../ui/TableActions';
import TicketCard from './TicketCard';
import {
  isSlaBreached,
  nextTicketAction,
  ticketContactLabel,
  ticketStatusLabel,
  type TicketItem,
} from './ticketUi';
import TicketSourceChip from './TicketSourceChip';

interface TicketListProps {
  tickets: TicketItem[];
  onOpen: (ticket: TicketItem) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  updatingId?: string | null;
}

export default function TicketList({ tickets, onOpen, onUpdateStatus, updatingId }: TicketListProps) {
  return (
    <ResponsiveDataView
      items={tickets}
      cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 lg:hidden"
      tableClassName="px-4 sm:px-5 pt-4 sm:pb-5"
      renderCard={(ticket) => (
        <TicketCard
          ticket={ticket}
          onUpdateStatus={(id, status) => onUpdateStatus?.(id, status)}
          onClick={() => onOpen(ticket)}
          updating={updatingId === ticket.id}
        />
      )}
      renderTable={() => (
        <DataTable headers={['Customer', 'Ticket', 'Source', 'Priority', 'Status', 'Actions']} serialNo={false} embedded>
          {tickets.map((ticket) => {
            const action = nextTicketAction(ticket.status);
            const customer = ticketContactLabel(ticket);
            const breached = isSlaBreached(ticket);

            return (
              <tr
                key={ticket.id}
                className={`group cursor-pointer transition-colors ${
                  breached ? 'bg-rose-50/50 dark:bg-rose-950/20' : 'hover:bg-theme-subtle/40'
                }`}
                onClick={() => onOpen(ticket)}
              >
                <td className="min-w-[180px]">
                  <div className="flex items-center gap-2.5">
                    {ticket.contact ? (
                      <ContactAvatar
                        name={ticket.contact.name || undefined}
                        phone={ticket.contact.phone}
                        size="sm"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-theme-fg">{customer}</p>
                      {ticket.contact?.name && ticket.contact?.phone && (
                        <p className="truncate text-[11px] text-theme-muted">{ticket.contact.phone}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="min-w-[160px] max-w-[280px]">
                  <p className="truncate text-[13px] font-medium text-theme-fg">{ticket.title}</p>
                  {ticket.assignedAgent?.name ? (
                    <p className="mt-0.5 truncate text-[11px] text-theme-muted">
                      Assigned · {ticket.assignedAgent.name}
                    </p>
                  ) : (
                    <p className="mt-0.5 truncate text-[11px] text-theme-muted">Unassigned</p>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  <TicketSourceChip ticket={ticket} />
                </td>
                <td className="whitespace-nowrap">
                  <PriorityBadge priority={ticket.priority} />
                </td>
                <td className="whitespace-nowrap">
                  <StatusBadge status={ticket.status} label={ticketStatusLabel(ticket.status)} />
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end">
                    {action ? (
                      <TableTextButton
                        variant="primary"
                        onClick={() => onUpdateStatus?.(ticket.id, action.next)}
                      >
                        {updatingId === ticket.id ? 'Updating…' : action.label}
                      </TableTextButton>
                    ) : (
                      <span className="text-[12px] text-theme-muted">View</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    />
  );
}
