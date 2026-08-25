import crypto from 'crypto';
import { config } from '../../config';
import { AppError } from '../../utils/response';
import logger from '../../utils/logger';

const RAZORPAY_API = 'https://api.razorpay.com/v1';

function authHeader(): string {
  const { keyId, keySecret } = config.razorpay;
  if (!keyId || !keySecret) {
    throw new AppError(503, 'Payment gateway is not configured');
  }
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

export function isRazorpayConfigured(): boolean {
  return Boolean(config.razorpay.keyId && config.razorpay.keySecret);
}

export async function createRazorpayOrder(params: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string }> {
  if (!Number.isSafeInteger(params.amountPaise) || params.amountPaise <= 0) {
    throw new AppError(400, 'Payment amount must be a positive integer');
  }

  const res = await fetch(`${RAZORPAY_API}/orders`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: 'INR',
      receipt: params.receipt,
      notes: params.notes,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    logger.error('Razorpay order creation failed', { source: 'razorpay', error: err });
    throw new AppError(502, 'Failed to create payment order');
  }

  const order = (await res.json()) as { id?: string; amount?: number; currency?: string };
  if (
    !order.id ||
    order.amount !== params.amountPaise ||
    order.currency !== 'INR'
  ) {
    logger.error('Razorpay returned an unexpected order amount or currency', {
      source: 'razorpay',
      expectedAmount: params.amountPaise,
      returnedAmount: order.amount,
      returnedCurrency: order.currency,
    });
    throw new AppError(502, 'Payment gateway returned an invalid order');
  }
  return { id: order.id, amount: order.amount, currency: order.currency };
}

export async function razorpayApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    logger.error('Razorpay API error', { source: 'razorpay', path, error: err });
    throw new AppError(502, 'Payment gateway request failed');
  }
  return res.json() as Promise<T>;
}

export async function createRazorpayPlan(params: {
  name: string;
  amountPaise: number;
  description: string;
  notes?: Record<string, string>;
}): Promise<{ id: string }> {
  return razorpayApi<{ id: string }>('/plans', {
    method: 'POST',
    body: JSON.stringify({
      period: 'monthly',
      interval: 1,
      item: {
        name: params.name,
        amount: params.amountPaise,
        currency: 'INR',
        description: params.description,
      },
      notes: params.notes,
    }),
  });
}

export async function createRazorpaySubscription(params: {
  planId: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; status: string; short_url?: string }> {
  return razorpayApi<{ id: string; status: string; short_url?: string }>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      plan_id: params.planId,
      customer_notify: 1,
      notes: params.notes,
    }),
  });
}

export async function cancelRazorpaySubscription(
  subscriptionId: string,
  cancelAtCycleEnd = true
): Promise<{ id: string; status: string }> {
  return razorpayApi<{ id: string; status: string }>(
    `/subscriptions/${subscriptionId}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }),
    }
  );
}

export async function fetchRazorpaySubscription(subscriptionId: string): Promise<{
  id: string;
  status: string;
  current_end?: number;
  notes?: Record<string, string>;
}> {
  return razorpayApi(`/subscriptions/${subscriptionId}`);
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status?: string;
};

export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  error_code?: string | null;
  error_description?: string | null;
};

export async function fetchRazorpayOrder(orderId: string): Promise<RazorpayOrder> {
  return razorpayApi<RazorpayOrder>(`/orders/${encodeURIComponent(orderId)}`);
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  return razorpayApi<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

export async function fetchRazorpayOrderPayments(orderId: string): Promise<RazorpayPayment[]> {
  const response = await razorpayApi<{ items?: RazorpayPayment[] }>(
    `/orders/${encodeURIComponent(orderId)}/payments`
  );
  return response.items || [];
}

/**
 * Entitlement is granted only after both provider resources agree exactly
 * with the immutable local order snapshot.
 */
export async function verifyCapturedPayment(params: {
  orderId: string;
  paymentId: string;
  amountPaise: number;
  currency: string;
}): Promise<{ order: RazorpayOrder; payment: RazorpayPayment }> {
  const [order, payment] = await Promise.all([
    fetchRazorpayOrder(params.orderId),
    fetchRazorpayPayment(params.paymentId),
  ]);

  if (
    order.id !== params.orderId ||
    order.amount !== params.amountPaise ||
    order.currency !== params.currency ||
    payment.id !== params.paymentId ||
    payment.order_id !== params.orderId ||
    payment.amount !== params.amountPaise ||
    payment.currency !== params.currency
  ) {
    throw new AppError(409, 'Payment amount, currency, or order does not match', 'PAYMENT_MISMATCH');
  }

  if (payment.status === 'failed') {
    throw new AppError(409, 'Provider reported that this payment failed', 'PAYMENT_FAILED');
  }
  if (payment.status === 'refunded') {
    throw new AppError(409, 'Provider reported that this payment was refunded', 'PAYMENT_REFUNDED');
  }
  if (payment.status === 'reversed') {
    throw new AppError(409, 'Provider reported that this payment was reversed', 'PAYMENT_REVERSED');
  }

  if (payment.status !== 'captured' || order.status !== 'paid') {
    throw new AppError(
      202,
      'Payment verification is pending provider confirmation',
      'VERIFICATION_PENDING'
    );
  }

  return { order, payment };
}

/**
 * Razorpay subscription checkout signature: payment_id|subscription_id
 */
export function verifySubscriptionPaymentSignature(
  subscriptionId: string,
  paymentId: string,
  signature: string
): boolean {
  if (!signature || !config.razorpay.keySecret) return false;
  const body = `${paymentId}|${subscriptionId}`;
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(body)
    .digest('hex');
  try {
    const actual = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    return actual.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actual);
  } catch {
    return false;
  }
}

/**
 * Phase 0 fix: use timing-safe comparison to prevent timing attacks.
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  if (!signature || !config.razorpay.keySecret) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(body)
    .digest('hex');
  try {
    const actual = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    return actual.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actual);
  } catch {
    // Buffer.from throws if signature is not valid hex — treat as invalid
    return false;
  }
}

/**
 * Phase 0 fix: timing-safe webhook signature verification.
 * Returns false (never throws) if secret is not configured — logs CRITICAL.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!config.razorpay.webhookSecret) {
    logger.error(
      'CRITICAL: RAZORPAY_WEBHOOK_SECRET is not set. All webhook events will be rejected. ' +
      'Set this env var before going live.'
    );
    return false;
  }
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', config.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  try {
    const actual = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    return actual.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actual);
  } catch {
    return false;
  }
}

/**
 * Phase 0 fix: planTier must come from the server-side PaymentOrder row,
 * never from the client. Caller is responsible for passing PaymentOrder.planId.
 * periodDays comes from the purchased SKU (30/90/365); defaults to 30 for
 * legacy callers that predate cadences.
 * Stacks renewal on top of any unexpired plan period.
 */
export async function activatePlan(
  organizationId: string,
  planTier: string,
  periodDays?: number,
  tx?: import('@prisma/client').Prisma.TransactionClient
) {
  const days = periodDays && periodDays > 0 ? periodDays : 30;
  const { default: prisma } = await import('../../config/database');
  const db = tx ?? prisma;

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { planExpiresAt: true },
  });
  if (!org) {
    throw new Error('Organization not found');
  }

  const now = new Date();
  const base =
    org.planExpiresAt && org.planExpiresAt > now ? new Date(org.planExpiresAt) : new Date(now);
  const expiresAt = new Date(base);
  expiresAt.setDate(expiresAt.getDate() + days);

  return db.organization.update({
    where: { id: organizationId },
    data: {
      plan: planTier,
      planExpiresAt: expiresAt,
      subscriptionStatus: 'active',
    },
  });
}
