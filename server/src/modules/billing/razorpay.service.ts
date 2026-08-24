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

  return res.json() as Promise<{ id: string; amount: number; currency: string }>;
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

/**
 * Razorpay subscription checkout signature: payment_id|subscription_id
 */
export function verifySubscriptionPaymentSignature(
  subscriptionId: string,
  paymentId: string,
  signature: string
): boolean {
  if (!signature) return false;
  const body = `${paymentId}|${subscriptionId}`;
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(body)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
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
  if (!signature) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(body)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
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
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
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
