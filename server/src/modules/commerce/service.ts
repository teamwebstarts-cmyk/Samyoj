import type { OrderPaymentStatus, OrderStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { emitToOrg } from '../../realtime';
import type { SendMessagePayload } from '../whatsapp/meta.service';
import { ordersForNumberFilter } from '../whatsapp/active-number';
import { assertCatalogAvailableForNumber } from '../catalog/service';
import { AppError } from '../../utils/response';

export interface OrderLineItem {
  retailerId: string;
  name: string;
  quantity: number;
  amountCents: number;
  imageUrl?: string;
}

export interface OrderCounts {
  total: number;
  pending: number;
  processing: number;
  shipped: number;
  completed: number;
  canceled: number;
}

type StoredOrderItem = {
  retailerId?: string;
  name?: string;
  quantity?: number;
  amountCents?: number;
  priceCents?: number;
  imageUrl?: string | null;
};

export function orderStatusCustomerMessage(status: OrderStatus, referenceId: string): string {
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

function readStoredItems(value: unknown): StoredOrderItem[] {
  return Array.isArray(value) ? (value as StoredOrderItem[]) : [];
}

function catalogKey(catalogId: string, retailerId: string) {
  return `${catalogId}:${retailerId}`;
}

async function catalogProductLookup(
  organizationId: string,
  pairs: Array<{ catalogId: string; retailerId: string }>
) {
  const catalogIds = [...new Set(pairs.map((pair) => pair.catalogId).filter(Boolean))];
  const retailerIds = [...new Set(pairs.map((pair) => pair.retailerId).filter(Boolean))];
  if (!catalogIds.length || !retailerIds.length) {
    return new Map<string, { name: string; imageUrl: string | null }>();
  }

  const products = await prisma.catalogProduct.findMany({
    where: {
      organizationId,
      metaCatalogId: { in: catalogIds },
      retailerId: { in: retailerIds },
    },
    select: { metaCatalogId: true, retailerId: true, name: true, imageUrl: true },
  });

  return new Map(
    products.map((product) => [
      catalogKey(product.metaCatalogId, product.retailerId),
      { name: product.name, imageUrl: product.imageUrl },
    ])
  );
}

function applyCatalogNames(
  catalogId: string | null | undefined,
  items: StoredOrderItem[],
  lookup: Map<string, { name: string; imageUrl: string | null }>
): StoredOrderItem[] {
  if (!catalogId) return items;
  return items.map((item) => {
    if (!item.retailerId) return item;
    const product = lookup.get(catalogKey(catalogId, item.retailerId));
    if (!product) return item;
    const hasFriendlyName = Boolean(item.name && item.name !== item.retailerId);
    return {
      ...item,
      name: hasFriendlyName ? item.name : product.name,
      imageUrl: item.imageUrl || product.imageUrl || undefined,
    };
  });
}

async function withCatalogNames<T extends { catalogId?: string | null; items: unknown }>(
  organizationId: string,
  orders: T[]
): Promise<T[]> {
  const pairs = orders.flatMap((order) => {
    if (!order.catalogId) return [];
    return readStoredItems(order.items)
      .map((item) => item.retailerId)
      .filter((retailerId): retailerId is string => Boolean(retailerId))
      .map((retailerId) => ({ catalogId: order.catalogId as string, retailerId }));
  });
  if (!pairs.length) return orders;

  const lookup = await catalogProductLookup(organizationId, pairs);
  return orders.map((order) => ({
    ...order,
    items: applyCatalogNames(order.catalogId, readStoredItems(order.items), lookup),
  }));
}

function emptyCounts(): OrderCounts {
  return { total: 0, pending: 0, processing: 0, shipped: 0, completed: 0, canceled: 0 };
}

function toCounts(rows: Array<{ status: OrderStatus; _count: { _all: number } }>): OrderCounts {
  const counts = emptyCounts();
  for (const row of rows) {
    const n = row._count._all;
    counts.total += n;
    if (row.status === 'PENDING') counts.pending += n;
    else if (row.status === 'PROCESSING') counts.processing += n;
    else if (row.status === 'SHIPPED' || row.status === 'PARTIALLY_SHIPPED') counts.shipped += n;
    else if (row.status === 'COMPLETED') counts.completed += n;
    else if (row.status === 'CANCELED') counts.canceled += n;
  }
  return counts;
}

function statusWhere(status?: OrderStatus): Prisma.OrderWhereInput {
  if (!status) return {};
  if (status === 'SHIPPED') {
    return { status: { in: ['SHIPPED', 'PARTIALLY_SHIPPED'] } };
  }
  return { status };
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
  const number = await prisma.whatsappNumber.findFirst({
    where: { id: input.whatsappNumberId, organizationId, isActive: true },
    select: { id: true },
  });
  if (!number) throw new AppError(400, 'WhatsApp number is not active for this organization');
  await assertCatalogAvailableForNumber(
    organizationId,
    input.catalogId,
    input.whatsappNumberId
  );
  const [contact, conversation] = await Promise.all([
    input.contactId
      ? prisma.contact.findFirst({
          where: { id: input.contactId, organizationId, whatsappNumberId: input.whatsappNumberId },
          select: { id: true },
        })
      : null,
    input.conversationId
      ? prisma.conversation.findFirst({
          where: { id: input.conversationId, organizationId, whatsappNumberId: input.whatsappNumberId },
          select: { id: true, contactId: true },
        })
      : null,
  ]);
  if (input.contactId && !contact) throw new AppError(400, 'Order contact is not on the active WhatsApp number');
  if (input.conversationId && !conversation) throw new AppError(400, 'Order conversation is not on the active WhatsApp number');
  if (conversation && contact && conversation.contactId !== contact.id) {
    throw new AppError(400, 'Order contact must match the conversation contact');
  }

  const lookup = await catalogProductLookup(
    organizationId,
    input.items.map((item) => ({ catalogId: input.catalogId, retailerId: item.retailerId }))
  );
  const items = applyCatalogNames(input.catalogId, input.items, lookup);

  let order;
  try {
    order = await prisma.order.create({
      data: {
        organizationId,
        contactId: input.contactId,
        conversationId: input.conversationId,
        whatsappNumberId: input.whatsappNumberId,
        catalogId: input.catalogId,
        referenceId: input.referenceId,
        items: items as unknown as Prisma.InputJsonValue,
        subtotalCents: input.amounts.subtotalCents,
        taxCents: input.amounts.taxCents,
        shippingCents: input.amounts.shippingCents,
        totalCents: input.amounts.totalCents,
        currency: input.amounts.currency,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error;
    }
    const existing = await prisma.order.findFirst({
      where: { organizationId, referenceId: input.referenceId },
      include: { contact: { select: { id: true, name: true, phone: true } } },
    });
    if (!existing) throw error;
    return existing;
  }

  emitToOrg(organizationId, 'order:new', {
    orderId: order.id,
    whatsappNumberId: order.whatsappNumberId,
    status: order.status,
    referenceId: order.referenceId,
  });

  return order;
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

  const allowed: Record<OrderStatus, readonly OrderStatus[]> = {
    PENDING: ['PENDING', 'PROCESSING', 'CANCELED'],
    PROCESSING: ['PROCESSING', 'PARTIALLY_SHIPPED', 'SHIPPED', 'CANCELED'],
    PARTIALLY_SHIPPED: ['PARTIALLY_SHIPPED', 'SHIPPED', 'COMPLETED'],
    SHIPPED: ['SHIPPED', 'COMPLETED'],
    COMPLETED: ['COMPLETED'],
    CANCELED: ['CANCELED'],
  };
  if (!allowed[existing.status].includes(status)) {
    throw new AppError(409, `Cannot move a ${existing.status.toLowerCase()} order to ${status.toLowerCase()}`);
  }
  const updatedCount = await prisma.order.updateMany({
    where: { id: orderId, organizationId, whatsappNumberId, status: existing.status },
    data: { status, statusNote },
  });
  if (updatedCount.count !== 1) {
    throw new AppError(409, 'Order changed while it was being updated');
  }
  const updated = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

  emitToOrg(organizationId, 'order:updated', {
    orderId: updated.id,
    whatsappNumberId: updated.whatsappNumberId,
    status: updated.status,
  });

  return updated;
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

  const allowed: Record<OrderPaymentStatus, readonly OrderPaymentStatus[]> = {
    PENDING: ['PENDING', 'CAPTURED', 'FAILED'],
    CAPTURED: ['CAPTURED'],
    FAILED: ['FAILED', 'PENDING'],
  };
  if (!allowed[existing.paymentStatus].includes(paymentStatus)) {
    throw new AppError(
      409,
      `Cannot move a ${existing.paymentStatus.toLowerCase()} payment to ${paymentStatus.toLowerCase()}`
    );
  }
  const updatedCount = await prisma.order.updateMany({
    where: {
      id: orderId,
      organizationId,
      whatsappNumberId,
      paymentStatus: existing.paymentStatus,
    },
    data: { paymentStatus },
  });
  if (updatedCount.count !== 1) {
    throw new AppError(409, 'Payment status changed while it was being updated');
  }
  return prisma.order.findUniqueOrThrow({ where: { id: orderId } });
}

export async function listOrders(
  organizationId: string,
  query: {
    status?: OrderStatus;
    search?: string;
    page?: number;
    limit?: number;
    whatsappNumberId?: string;
  }
) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 50));
  const skip = (page - 1) * limit;
  const search = query.search?.trim();

  const numberFilter = ordersForNumberFilter(query.whatsappNumberId);
  const where: Prisma.OrderWhereInput = {
    organizationId,
    ...statusWhere(query.status),
    ...numberFilter,
    ...(search
      ? {
          OR: [
            { referenceId: { contains: search, mode: 'insensitive' } },
            { contact: { name: { contains: search, mode: 'insensitive' } } },
            { contact: { phone: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const countWhere: Prisma.OrderWhereInput = {
    organizationId,
    ...numberFilter,
  };

  const [orders, total, grouped] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        conversation: { select: { id: true } },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({
      by: ['status'],
      where: countWhere,
      _count: { _all: true },
    }),
  ]);

  const enriched = await withCatalogNames(organizationId, orders);
  return { orders: enriched, total, page, limit, counts: toCounts(grouped) };
}

export async function getOrder(organizationId: string, orderId: string, whatsappNumberId?: string) {
  if (!whatsappNumberId) return null;
  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId, whatsappNumberId },
    include: {
      contact: { select: { id: true, name: true, phone: true } },
      conversation: { select: { id: true, status: true } },
    },
  });
  if (!order) return null;
  const [enriched] = await withCatalogNames(organizationId, [order]);
  return enriched;
}
