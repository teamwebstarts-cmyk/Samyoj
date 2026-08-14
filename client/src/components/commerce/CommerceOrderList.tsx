import ContactAvatar from '../inbox/ContactAvatar';
import DataTable from '../ui/DataTable';
import ResponsiveDataView from '../ui/ResponsiveDataView';
import StatusBadge from '../ui/StatusBadge';
import { TableTextButton } from '../ui/TableActions';
import CommerceOrderCard from './CommerceOrderCard';
import {
  customerDisplayName,
  formatOrderDate,
  formatOrderMoney,
  itemCountLabel,
  nextAction,
  orderStatusLabel,
  type CommerceOrder,
} from './commerceUi';

interface CommerceOrderListProps {
  orders: CommerceOrder[];
  onOpen: (order: CommerceOrder) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  updatingId?: string | null;
  preview?: boolean;
}

export default function CommerceOrderList({
  orders,
  onOpen,
  onUpdateStatus,
  updatingId,
  preview = false,
}: CommerceOrderListProps) {
  return (
    <ResponsiveDataView
      items={orders}
      cardClassName={`divide-y divide-neutral-200 dark:divide-neutral-800 lg:hidden ${
        preview ? 'pointer-events-auto' : ''
      }`}
      tableClassName="px-4 sm:px-5 pt-4 sm:pb-5"
      renderCard={(order) => (
        <CommerceOrderCard
          order={order}
          preview={preview}
          onUpdateStatus={(id, status) => onUpdateStatus?.(id, status)}
          onClick={() => onOpen(order)}
          updating={updatingId === order.id}
        />
      )}
      renderTable={() => (
        <DataTable headers={['Customer', 'Order', 'Total', 'Status', 'Actions']} serialNo={false} embedded>
          {orders.map((order) => {
            const action = nextAction(order.status);
            const customer = customerDisplayName(order);
            const items = itemCountLabel(order.items);

            return (
              <tr
                key={order.id}
                className="group cursor-pointer transition-colors hover:bg-theme-subtle/40"
                onClick={() => onOpen(order)}
              >
                <td className="min-w-[180px]">
                  <div className="flex items-center gap-2.5">
                    <ContactAvatar
                      name={order.contact?.name || undefined}
                      phone={order.contact?.phone || order.referenceId}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-theme-fg">{customer}</p>
                      {order.contact?.name && order.contact?.phone && (
                        <p className="truncate text-[11px] text-theme-muted">{order.contact.phone}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="min-w-[140px]">
                  <p className="text-[12px] font-medium text-theme-fg">{formatOrderDate(order.createdAt)}</p>
                  <p className="mt-0.5 text-[11px] text-theme-muted">{items || 'Catalog order'}</p>
                </td>
                <td className="whitespace-nowrap font-semibold tabular-nums text-theme-fg">
                  {formatOrderMoney(order.totalCents, order.currency)}
                </td>
                <td className="whitespace-nowrap">
                  <StatusBadge status={order.status} label={orderStatusLabel(order.status)} />
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end">
                    {action ? (
                      <TableTextButton
                        variant="primary"
                        onClick={() => {
                          if (preview) onOpen(order);
                          else onUpdateStatus?.(order.id, action.next);
                        }}
                      >
                        {updatingId === order.id ? 'Updating…' : action.label}
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
