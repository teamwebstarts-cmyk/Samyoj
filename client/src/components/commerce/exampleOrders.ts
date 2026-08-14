import type { CommerceOrder } from './commerceUi';

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

/** Local preview only — not saved, not sent to WhatsApp. */
export const EXAMPLE_ORDERS: CommerceOrder[] = [
  {
    id: 'example-pending',
    referenceId: 'ord_demo_1042',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    totalCents: 189900,
    currency: 'INR',
    createdAt: hoursAgo(2),
    conversationId: null,
    contact: { name: 'Priya Sharma', phone: '919876543210' },
    items: [
      { name: 'Cotton kurta', quantity: 1, amountCents: 129900 },
      { name: 'Printed dupatta', quantity: 1, amountCents: 60000 },
    ],
  },
  {
    id: 'example-processing',
    referenceId: 'ord_demo_1041',
    status: 'PROCESSING',
    paymentStatus: 'CAPTURED',
    totalCents: 249900,
    currency: 'INR',
    createdAt: hoursAgo(8),
    conversationId: null,
    contact: { name: 'Rahul Mehta', phone: '919812345678' },
    items: [{ name: 'Wireless earbuds', quantity: 1, amountCents: 249900 }],
  },
  {
    id: 'example-shipped',
    referenceId: 'ord_demo_1038',
    status: 'SHIPPED',
    paymentStatus: 'CAPTURED',
    totalCents: 425000,
    currency: 'INR',
    createdAt: hoursAgo(26),
    conversationId: null,
    contact: { name: 'Ananya Iyer', phone: '919700112233' },
    items: [
      { name: 'Ceramic dinner set', quantity: 1, amountCents: 349900 },
      { name: 'Gift wrap', quantity: 1, amountCents: 75100 },
    ],
  },
];
