export interface CommerceOrderItem {
  retailerId?: string;
  name?: string;
  quantity?: number;
  amountCents?: number;
  priceCents?: number;
  imageUrl?: string | null;
}

export interface CommerceOrder {
  id: string;
  referenceId: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  updatedAt?: string;
  statusNote?: string | null;
  conversationId?: string | null;
  conversation?: { id?: string | null } | null;
  contact?: {
    id?: string;
    name?: string | null;
    phone: string;
    conversationId?: string | null;
  } | null;
  items?: CommerceOrderItem[];
  subtotalCents?: number;
  taxCents?: number;
  shippingCents?: number;
}

export interface OrderCounts {
  total: number;
  pending: number;
  processing: number;
  shipped: number;
  completed: number;
  canceled: number;
}

export const emptyOrderCounts: OrderCounts = {
  total: 0,
  pending: 0,
  processing: 0,
  shipped: 0,
  completed: 0,
  canceled: 0,
};

export const ORDER_STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'To prepare' },
  { value: 'PROCESSING', label: 'Preparing' },
  { value: 'SHIPPED', label: 'On the way' },
  { value: 'COMPLETED', label: 'Done' },
  { value: 'CANCELED', label: 'Canceled' },
] as const;

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'To prepare',
  PROCESSING: 'Preparing',
  PARTIALLY_SHIPPED: 'Partly shipped',
  SHIPPED: 'On the way',
  COMPLETED: 'Complete',
  CANCELED: 'Canceled',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Unpaid',
  CAPTURED: 'Paid',
  FAILED: 'Payment failed',
};

export const FULFILLMENT_STEPS = ['PENDING', 'PROCESSING', 'SHIPPED', 'COMPLETED'] as const;

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, ' ').toLowerCase();
}

export function paymentStatusLabel(status: string) {
  return PAYMENT_STATUS_LABELS[status] ?? status.replace(/_/g, ' ').toLowerCase();
}

export function nextAction(status: string): { label: string; next: string } | null {
  if (status === 'PENDING') return { label: 'Start preparing', next: 'PROCESSING' };
  if (status === 'PROCESSING') return { label: 'Mark on the way', next: 'SHIPPED' };
  if (status === 'SHIPPED' || status === 'PARTIALLY_SHIPPED') {
    return { label: 'Mark complete', next: 'COMPLETED' };
  }
  return null;
}

export function canCancelOrder(status: string) {
  return status === 'PENDING' || status === 'PROCESSING';
}

export function orderConversationId(order: Pick<CommerceOrder, 'conversationId' | 'conversation' | 'contact'>) {
  return order.conversationId || order.conversation?.id || order.contact?.conversationId || null;
}

export function customerDisplayName(order: Pick<CommerceOrder, 'contact'>) {
  return order.contact?.name || order.contact?.phone || 'Unknown customer';
}

export function parseOrderItems(items: unknown): Array<{
  name: string;
  quantity: number;
  unitCents: number;
  lineCents: number;
  retailerId?: string;
  imageUrl?: string;
}> {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = (raw || {}) as CommerceOrderItem;
    const quantity = Number(item.quantity) || 1;
    const unitCents = Number(item.amountCents ?? item.priceCents ?? 0) || 0;
    const retailerId = item.retailerId;
    const name =
      item.name && item.name !== retailerId ? item.name : retailerId ? 'Catalog item' : 'Item';
    return {
      name,
      quantity,
      unitCents,
      lineCents: unitCents * quantity,
      retailerId,
      imageUrl: item.imageUrl || undefined,
    };
  });
}

export function itemCountLabel(items: unknown) {
  const count = parseOrderItems(items).reduce((sum, item) => sum + item.quantity, 0);
  if (!count) return null;
  return `${count} item${count === 1 ? '' : 's'}`;
}

export function orderStatusCustomerMessage(status: string, referenceId: string) {
  switch (status) {
    case 'PENDING':
      return `We received your order ${referenceId}. We'll start preparing it shortly.`;
    case 'PROCESSING':
      return `We're preparing your order ${referenceId}.`;
    case 'PARTIALLY_SHIPPED':
      return `Part of your order ${referenceId} is on the way.`;
    case 'SHIPPED':
      return `Your order ${referenceId} is on the way.`;
    case 'COMPLETED':
      return `Your order ${referenceId} is complete. Thank you!`;
    case 'CANCELED':
      return `Your order ${referenceId} was canceled.`;
    default:
      return `Your order ${referenceId} was updated.`;
  }
}

export function formatOrderMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
  }).format(cents / 100);
}

export function formatOrderDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatOrderDateLong(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fulfillmentStepIndex(status: string) {
  if (status === 'PARTIALLY_SHIPPED') return FULFILLMENT_STEPS.indexOf('SHIPPED');
  if (status === 'CANCELED') return -1;
  return FULFILLMENT_STEPS.indexOf(status as (typeof FULFILLMENT_STEPS)[number]);
}
