import { ArrowRight } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import StatusBadge from '../ui/StatusBadge';
import {
  customerDisplayName,
  formatOrderDate,
  formatOrderMoney,
  itemCountLabel,
  nextAction,
  orderStatusLabel,
  type CommerceOrder,
} from './commerceUi';

interface CommerceOrderCardProps {
  order: CommerceOrder;
  onUpdateStatus?: (id: string, status: string) => void;
  onClick?: () => void;
  updating?: boolean;
}

export default function CommerceOrderCard({
  order,
  onUpdateStatus,
  onClick,
  updating,
}: CommerceOrderCardProps) {
  const customer = customerDisplayName(order);
  const action = nextAction(order.status);
  const items = itemCountLabel(order.items);

  return (
    <article className="bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50">
      <button type="button" onClick={onClick} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        <ContactAvatar
          name={order.contact?.name || undefined}
          phone={order.contact?.phone || order.referenceId}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-theme-fg">{customer}</p>
              <p className="mt-0.5 text-[11px] text-theme-muted">
                {formatOrderDate(order.createdAt)}
                {items ? ` · ${items}` : ''}
              </p>
            </div>
            <p className="shrink-0 text-[13px] font-extrabold tabular-nums text-theme-fg">
              {formatOrderMoney(order.totalCents, order.currency)}
            </p>
          </div>
          <div className="mt-2">
            <StatusBadge status={order.status} label={orderStatusLabel(order.status)} />
          </div>
        </div>
      </button>
      {action && (
        <div className="border-t border-theme-border/60 bg-theme-subtle/20 px-3 py-2.5">
          <AppButton
            variant="secondary"
            size="sm"
            className="w-full"
            icon={<ArrowRight size={14} />}
            loading={updating}
            onClick={(e) => {
              e.stopPropagation();
              onUpdateStatus?.(order.id, action.next);
            }}
          >
            {action.label}
          </AppButton>
        </div>
      )}
    </article>
  );
}
