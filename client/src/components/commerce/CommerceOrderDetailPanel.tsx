import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, ShoppingBag } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import { WhatsAppBubble, WhatsAppChatSurface } from '../inbox/WhatsAppPreview';
import AppButton from '../ui/AppButton';
import AppTextarea from '../ui/AppTextarea';
import ConfirmDialog from '../ui/ConfirmDialog';
import LoadingState from '../ui/LoadingState';
import StatusBadge from '../ui/StatusBadge';
import SlideOver from '../ui/SlideOver';
import { ModalPanel, ModalSection } from '../ui/modalUi';
import {
  FULFILLMENT_STEPS,
  canCancelOrder,
  customerDisplayName,
  formatOrderDateLong,
  formatOrderMoney,
  fulfillmentStepIndex,
  nextAction,
  orderConversationId,
  orderStatusCustomerMessage,
  orderStatusLabel,
  parseOrderItems,
  paymentStatusLabel,
  type CommerceOrder,
} from './commerceUi';

interface CommerceOrderDetailPanelProps {
  order: CommerceOrder | null;
  open: boolean;
  onClose: () => void;
  onUpdateStatus: (
    id: string,
    status: string,
    options?: { statusNote?: string; notifyContact?: boolean }
  ) => Promise<void> | void;
  updating?: boolean;
  loading?: boolean;
}

export default function CommerceOrderDetailPanel({
  order,
  open,
  onClose,
  onUpdateStatus,
  updating,
  loading,
}: CommerceOrderDetailPanelProps) {
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [statusNote, setStatusNote] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    setNotifyCustomer(true);
    setStatusNote('');
    setCancelOpen(false);
  }, [order?.id]);

  if (!order) return null;

  const action = nextAction(order.status);
  const customer = customerDisplayName(order);
  const currentStep = fulfillmentStepIndex(order.status);
  const items = parseOrderItems(order.items);
  const conversationId = orderConversationId(order);
  const previewStatus = action?.next || order.status;
  const previewMessage = statusNote.trim()
    ? `${orderStatusCustomerMessage(previewStatus, order.referenceId)}\n${statusNote.trim()}`
    : orderStatusCustomerMessage(previewStatus, order.referenceId);

  const runUpdate = async (status: string) => {
    await onUpdateStatus(order.id, status, {
      statusNote: statusNote.trim() || undefined,
      notifyContact: notifyCustomer,
    });
    setStatusNote('');
    setCancelOpen(false);
  };

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title={customer}
        subtitle={`${formatOrderDateLong(order.createdAt)} · ${order.referenceId}`}
        icon={ShoppingBag}
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
                onClick={() => void runUpdate(action.next)}
                className="sm:flex-1"
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
              <div className="min-w-0">
                <p className="truncate font-extrabold text-theme-fg">{customer}</p>
                {order.contact?.phone && order.contact?.name && (
                  <p className="mt-0.5 text-[12px] text-theme-muted">{order.contact.phone}</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <StatusBadge status={order.status} label={orderStatusLabel(order.status)} />
                  <StatusBadge
                    status={order.paymentStatus}
                    label={paymentStatusLabel(order.paymentStatus)}
                  />
                </div>
              </div>
            </div>

            <ModalPanel accent="emerald">
              <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">Order total</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-theme-fg">
                {formatOrderMoney(order.totalCents, order.currency)}
              </p>
            </ModalPanel>

            {currentStep >= 0 && (
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-theme-muted">Progress</p>
                <div className="flex gap-1">
                  {FULFILLMENT_STEPS.map((step, i) => (
                    <div
                      key={step}
                      className={`h-1.5 flex-1 rounded-full ${
                        i <= currentStep ? 'bg-whatsapp-500' : 'bg-theme-subtle'
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between gap-1 text-[10px] font-semibold text-theme-muted">
                  {FULFILLMENT_STEPS.map((step, i) => (
                    <span key={step} className={i === currentStep ? 'text-emerald-700 dark:text-emerald-300' : ''}>
                      {orderStatusLabel(step)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {items.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-theme-muted">Items</p>
                <ul className="divide-y divide-theme-border overflow-hidden rounded-xl border border-theme-border">
                  {items.map((item, i) => (
                    <li
                      key={`${item.name}-${i}`}
                      className="flex items-center justify-between gap-3 bg-theme-surface px-3 py-2.5 text-[13px]"
                    >
                      <span className="min-w-0 font-medium text-theme-fg">
                        {item.quantity}× {item.name}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-theme-secondary">
                        {formatOrderMoney(item.lineCents, order.currency)}
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

            {action && (
              <ModalSection
                title="Update the customer"
                subtitle="They see this on WhatsApp when you move the order forward."
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-theme-border bg-theme-surface px-3.5 py-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-theme-border text-emerald-600 focus:ring-emerald-500"
                    checked={notifyCustomer}
                    onChange={(e) => setNotifyCustomer(e.target.checked)}
                  />
                  <span>
                    <span className="block text-[13px] font-semibold text-theme-fg">Tell customer on WhatsApp</span>
                    <span className="mt-0.5 block text-[12px] text-theme-muted">
                      Sends the status update to their chat.
                    </span>
                  </span>
                </label>

                <AppTextarea
                  label="Optional note"
                  hint="Shown with the update"
                  rows={2}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Out for delivery this evening"
                />

                {notifyCustomer && (
                  <WhatsAppChatSurface compact className="overflow-hidden rounded-2xl">
                    <WhatsAppBubble direction="outbound" content={previewMessage} compact time="now" />
                  </WhatsAppChatSurface>
                )}
              </ModalSection>
            )}

            {conversationId && (
              <Link to={`/inbox?conversation=${conversationId}`} onClick={onClose}>
                <AppButton variant="secondary" icon={<Inbox size={16} />} className="w-full">
                  Message customer
                </AppButton>
              </Link>
            )}

            {canCancelOrder(order.status) && (
              <button
                type="button"
                className="w-full text-center text-[12px] font-semibold text-rose-600 hover:underline dark:text-rose-400"
                onClick={() => setCancelOpen(true)}
              >
                Cancel order
              </button>
            )}
          </div>
        )}
      </SlideOver>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => void runUpdate('CANCELED')}
        title="Cancel this order?"
        description={
          notifyCustomer
            ? 'The customer will be told on WhatsApp that the order was canceled.'
            : 'This order will be marked canceled. The customer will not be notified.'
        }
        confirmLabel="Cancel order"
        variant="danger"
        loading={updating}
      />
    </>
  );
}
