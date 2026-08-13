import type { OrderPaymentStatus, OrderStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import type { SendMessagePayload } from '../whatsapp/meta.service';
import { ordersForNumberFilter } from '../whatsapp/active-number';

export interface OrderLineItem {
  retailerId: string;
  name: string;
  quantity: number;
  amountCents: number;
}

export interface OrderAmounts {
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  offset?: number;
}

function toMetaAmount(cents: number, offset = 100) {
  return { value: cents, offset };
}

export function buildOrderDetailsPayload(
  phone: string,
  input: {
    referenceId: string;
    body: string;
    footer?: string;
    headerImageUrl?: string;
    items: OrderLineItem[];
    amounts: OrderAmounts;
    paymentType?: string;
  }
): SendMessagePayload {
  const offset = input.amounts.offset ?? 100;

  return {
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'order_details',
      ...(input.headerImageUrl
        ? { header: { type: 'image', image: { link: input.headerImageUrl } } }
        : {}),
      body: { text: input.body.slice(0, 1024) },
      ...(input.footer ? { footer: { text: input.footer.slice(0, 60) } } : {}),
      action: {
        name: 'review_and_pay',
        parameters: {
          reference_id: input.referenceId,
          type: input.paymentType || 'digital-goods',
          order: {
            status: 'pending',
            items: input.items.map((item) => ({
              retailer_id: item.retailerId,
              name: item.name.slice(0, 100),
              amount: toMetaAmount(item.amountCents, offset),
              quantity: item.quantity,
            })),
            subtotal: toMetaAmount(input.amounts.subtotalCents, offset),
            tax: toMetaAmount(input.amounts.taxCents, offset),
            shipping: toMetaAmount(input.amounts.shippingCents, offset),
            total: toMetaAmount(input.amounts.totalCents, offset),
          },
        },
      },
    },
  };
}

export function buildOrderStatusPayload(
  phone: string,
  input: {
    referenceId: string;
    body: string;
    status: OrderStatus;
    description?: string;
  }
): SendMessagePayload {
  const statusMap: Record<OrderStatus, string> = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    PARTIALLY_SHIPPED: 'partially_shipped',
    SHIPPED: 'shipped',
    COMPLETED: 'completed',
    CANCELED: 'canceled',
  };

  return {
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'order_status',
      body: { text: input.body.slice(0, 1024) },
      action: {
        name: 'review_order',
        parameters: {
          reference_id: input.referenceId,
          order: {
            status: statusMap[input.status],
            ...(input.description ? { description: input.description.slice(0, 120) } : {}),
          },
        },
      },
    },
  };
}

export function buildPaymentStatusPayload(
  phone: string,
  input: {
    referenceId: string;
    body: string;
    status: OrderPaymentStatus;
    amountCents: number;
    currency: string;
    offset?: number;
  }
): SendMessagePayload {
  const statusMap: Record<OrderPaymentStatus, string> = {
    PENDING: 'pending',
    CAPTURED: 'captured',
    FAILED: 'failed',
  };

  return {
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'payment_status',
      body: { text: input.body.slice(0, 1024) },
      action: {
        name: 'review_payment',
        parameters: {
          reference_id: input.referenceId,
          payment: {
            status: statusMap[input.status],
            amount: toMetaAmount(input.amountCents, input.offset ?? 100),
            currency: input.currency,
          },
        },
      },
    },
  };
}

export async function createOrderFromInbound(
  organizationId: string,
  input: {
    contactId?: string;
    conversationId?: string;
    whatsappNumberId: string;
    catalogId: string;
    referenceId: string;
    items: OrderLineItem[];
    amounts: OrderAmounts;
    metadata?: Record<string, unknown>;
  }
) {
  return prisma.order.create({
    data: {
      organizationId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      whatsappNumberId: input.whatsappNumberId,
      catalogId: input.catalogId,
      referenceId: input.referenceId,
      items: input.items as unknown as Prisma.InputJsonValue,
      subtotalCents: input.amounts.subtotalCents,
      taxCents: input.amounts.taxCents,
      shippingCents: input.amounts.shippingCents,
      totalCents: input.amounts.totalCents,
      currency: input.amounts.currency,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function updateOrderStatus(
  organizationId: string,
  orderId: string,
  status: OrderStatus,
  statusNote?: string,
  whatsappNumberId?: string
) {
  if (!whatsappNumberId) return null;
  const existing = await prisma.order.findFirst({
    where: { id: orderId, organizationId, whatsappNumberId },
  });
  if (!existing) return null;

  return prisma.order.update({
    where: { id: orderId },
    data: { status, statusNote },
  });
}

export async function updateOrderPaymentStatus(
  organizationId: string,
  orderId: string,
  paymentStatus: OrderPaymentStatus,
  whatsappNumberId?: string
) {
  if (!whatsappNumberId) return null;
  const existing = await prisma.order.findFirst({
    where: { id: orderId, organizationId, whatsappNumberId },
  });
  if (!existing) return null;

  return prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus },
  });
}

export async function listOrders(
  organizationId: string,
  query: { status?: OrderStatus; page?: number; limit?: number; whatsappNumberId?: string }
) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 50));
  const skip = (page - 1) * limit;

  const where = {
    organizationId,
    ...(query.status ? { status: query.status } : {}),
    ...ordersForNumberFilter(query.whatsappNumberId),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        contact: { select: { id: true, name: true, phone: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, limit };
}

export async function getOrder(organizationId: string, orderId: string, whatsappNumberId?: string) {
  if (!whatsappNumberId) return null;
  return prisma.order.findFirst({
    where: { id: orderId, organizationId, whatsappNumberId },
    include: {
      contact: { select: { id: true, name: true, phone: true } },
      conversation: { select: { id: true, status: true } },
    },
  });
}
