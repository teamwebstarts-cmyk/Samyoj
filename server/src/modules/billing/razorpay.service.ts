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

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(body)
    .digest('hex');
  return expected === signature;
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!config.razorpay.webhookSecret) return false;
  const expected = crypto
    .createHmac('sha256', config.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
}

export async function activatePlan(organizationId: string, planId: string) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { default: prisma } = await import('../../config/database');
  return prisma.organization.update({
    where: { id: organizationId },
    data: {
      plan: planId,
      planExpiresAt: expiresAt,
      subscriptionStatus: 'active',
    },
  });
}
