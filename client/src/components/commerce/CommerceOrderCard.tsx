import { ArrowRight } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import StatusBadge from '../ui/StatusBadge';

export interface CommerceOrder {
  id: string;
  referenceId: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  contact?: { name?: string | null; phone: string } | null;
}

interface CommerceOrderCardProps {
  order: CommerceOrder;
  onUpdateStatus: (id: string, status: string) => void;
  formatMoney: (cents: number, currency: string) => string;
  formatDate: (value: string) => string;
  onClick?: () => void;
  updating?: boolean;
}

function nextAction(status: string): { label: string; next: string } | null {
  if (status === 'PENDING') return { label: 'Mark processing', next: 'PROCESSING' };
  if (status === 'PROCESSING') return { label: 'Mark shipped', next: 'SHIPPED' };
  if (status === 'SHIPPED' || status === 'PARTIALLY_SHIPPED') {
    return { label: 'Mark completed', next: 'COMPLETED' };
  }
  return null;
}

export default function CommerceOrderCard({
  order,
  onUpdateStatus,
  formatMoney,
  formatDate,
  onClick,
  updating,
}: CommerceOrderCardProps) {
  const customer = order.contact?.name || order.contact?.phone || 'Unknown customer';
  const action = nextAction(order.status);

  return (
    <article className="bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50">
      <button type="button" onClick={onClick} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        <ContactAvatar
          name={order.contact?.name || undefined}
          phone={order.contact?.phone || order.referenceId}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="truncate text-[13px] font-bold text-theme-fg">{customer}</p>
            <p className="shrink-0 text-[12px] font-extrabold tabular-nums text-theme-fg">
              {formatMoney(order.totalCents, order.currency)}
            </p>
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-theme-muted">{order.referenceId}</p>
          <p className="mt-1 text-[11px] text-theme-secondary">{formatDate(order.createdAt)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge status={order.status} />
            <StatusBadge status={order.paymentStatus} />
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
              onUpdateStatus(order.id, action.next);
            }}
          >
            {action.label}
          </AppButton>
        </div>
      )}
    </article>
  );
}

export { nextAction };
