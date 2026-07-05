import { Link } from 'react-router-dom';
import { Inbox, ShoppingBag } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import LoadingState from '../ui/LoadingState';
import StatusBadge from '../ui/StatusBadge';
import SlideOver from '../ui/SlideOver';
import { ModalPanel } from '../ui/modalUi';
import { nextAction } from './CommerceOrderCard';

interface OrderDetail {
  id: string;
  referenceId: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  updatedAt?: string;
  statusNote?: string | null;
  contact?: {
    id?: string;
    name?: string | null;
    phone: string;
    conversationId?: string | null;
  } | null;
  items?: Array<{ name: string; quantity: number; priceCents: number }>;
}

interface CommerceOrderDetailPanelProps {
  order: OrderDetail | null;
  open: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  updating?: boolean;
  loading?: boolean;
  formatMoney: (cents: number, currency: string) => string;
  formatDate: (value: string) => string;
}

const STATUS_STEPS = ['PENDING', 'PROCESSING', 'SHIPPED', 'COMPLETED'];

export default function CommerceOrderDetailPanel({
  order,
  open,
  onClose,
  onUpdateStatus,
  updating,
  loading,
  formatMoney,
  formatDate,
}: CommerceOrderDetailPanelProps) {
  if (!order) return null;

  const action = nextAction(order.status);
  const customer = order.contact?.name || order.contact?.phone || 'Unknown';
  const currentStep = STATUS_STEPS.indexOf(order.status);

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={`Order ${order.referenceId}`}
      subtitle={formatDate(order.createdAt)}
      icon={ShoppingBag}
      accent="emerald"
      footer={
        <div className="flex w-full gap-2">
          <AppButton variant="secondary" size="sm" onClick={onClose} className="flex-1">
            Close
          </AppButton>
          {action && (
            <AppButton
              size="sm"
              loading={updating}
              onClick={() => onUpdateStatus(order.id, action.next)}
              className="flex-1"
            >
              {action.label}
            </AppButton>
          )}
        </div>
      }
    >
      {loading ? (
        <LoadingState label="Loading order details..." />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <ContactAvatar
              name={order.contact?.name || undefined}
              phone={order.contact?.phone || order.referenceId}
              size="md"
            />
            <div>
              <p className="font-extrabold text-theme-fg">{customer}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <StatusBadge status={order.status} />
                <StatusBadge status={order.paymentStatus} />
              </div>
            </div>
          </div>

          <ModalPanel accent="emerald">
            <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">Order total</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-theme-fg">
              {formatMoney(order.totalCents, order.currency)}
            </p>
          </ModalPanel>

          {currentStep >= 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-theme-muted">Progress</p>
              <div className="flex gap-1">
                {STATUS_STEPS.map((step, i) => (
                  <div
                    key={step}
                    className={`h-1.5 flex-1 rounded-full ${
                      i <= currentStep ? 'bg-whatsapp-500' : 'bg-theme-subtle'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {order.items && order.items.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-theme-muted">Items</p>
              <ul className="divide-y divide-theme-border overflow-hidden rounded-xl border border-theme-border">
                {order.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between bg-theme-surface px-3 py-2.5 text-[13px]"
                  >
                    <span className="font-medium text-theme-fg">
                      {item.quantity}× {item.name}
                    </span>
                    <span className="font-semibold tabular-nums text-theme-secondary">
                      {formatMoney(item.priceCents * item.quantity, order.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {order.statusNote && (
            <div className="rounded-xl border border-theme-border bg-theme-subtle/40 px-3 py-2.5 text-[13px] text-theme-secondary">
              {order.statusNote}
            </div>
          )}

          {order.contact?.conversationId && (
            <Link to={`/inbox?conversation=${order.contact.conversationId}`} onClick={onClose}>
              <AppButton variant="secondary" icon={<Inbox size={16} />} className="w-full">
                Message customer
              </AppButton>
            </Link>
          )}
        </div>
      )}
    </SlideOver>
  );
}
