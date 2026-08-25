import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    razorpay: {
      keyId: 'rzp_test_abc',
      keySecret: 'secret_123',
      webhookSecret: 'whsec_456',
    },
  },
}));

vi.mock('../../config', () => ({ config: mockConfig }));

vi.mock('../../utils/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  createModuleLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../../config/database', () => ({
  default: {
    organization: { update: vi.fn(), findUnique: vi.fn() },
  },
}));

import {
  isRazorpayConfigured,
  verifyPaymentSignature,
  verifySubscriptionPaymentSignature,
  verifyWebhookSignature,
  verifyCapturedPayment,
  createRazorpayOrder,
  activatePlan,
} from './razorpay.service';
import prisma from '../../config/database';

const orgUpdate = vi.mocked(prisma.organization.update);
const orgFindUnique = vi.mocked(prisma.organization.findUnique);

beforeEach(() => {
  vi.clearAllMocks();
  // Reset config to healthy defaults
  mockConfig.razorpay.keyId = 'rzp_test_abc';
  mockConfig.razorpay.keySecret = 'secret_123';
  mockConfig.razorpay.webhookSecret = 'whsec_456';
});

describe('isRazorpayConfigured', () => {
  it('returns true when both keyId and keySecret are set', () => {
    expect(isRazorpayConfigured()).toBe(true);
  });

  it('returns false when keyId is empty', () => {
    mockConfig.razorpay.keyId = '';
    expect(isRazorpayConfigured()).toBe(false);
  });

  it('returns false when keySecret is empty', () => {
    mockConfig.razorpay.keySecret = '';
    expect(isRazorpayConfigured()).toBe(false);
  });

  it('returns false when both are empty', () => {
    mockConfig.razorpay.keyId = '';
    mockConfig.razorpay.keySecret = '';
    expect(isRazorpayConfigured()).toBe(false);
  });
});

describe('verifyPaymentSignature', () => {
  it('payment-hmac-integrity-ok: returns true for a valid HMAC-SHA256 signature', () => {
    const orderId = 'order_ABC';
    const paymentId = 'pay_XYZ';
    const body = `${orderId}|${paymentId}`;
    const expected = crypto.createHmac('sha256', 'secret_123').update(body).digest('hex');

    expect(verifyPaymentSignature(orderId, paymentId, expected)).toBe(true);
    console.log('payment-hmac-integrity-ok');
  });

  it('returns false for an invalid signature', () => {
    expect(verifyPaymentSignature('order_ABC', 'pay_XYZ', 'garbage')).toBe(false);
  });

  it('returns false when orderId or paymentId differ', () => {
    const body = 'order_ABC|pay_XYZ';
    const sig = crypto.createHmac('sha256', 'secret_123').update(body).digest('hex');

    expect(verifyPaymentSignature('order_ABC', 'pay_DIFF', sig)).toBe(false);
  });

  it('returns false for empty signature', () => {
    expect(verifyPaymentSignature('order_ABC', 'pay_XYZ', '')).toBe(false);
  });

  it('returns false for wrong-length signature (timing safe buffer check)', () => {
    const wrongLength = 'abcd';
    expect(verifyPaymentSignature('order_ABC', 'pay_XYZ', wrongLength)).toBe(false);
  });
});

describe('verifySubscriptionPaymentSignature', () => {
  it('subscription-signature-ok: validates payment_id|subscription_id HMAC', () => {
    const subscriptionId = 'sub_ABC';
    const paymentId = 'pay_XYZ';
    const body = `${paymentId}|${subscriptionId}`;
    const expected = crypto.createHmac('sha256', 'secret_123').update(body).digest('hex');

    expect(verifySubscriptionPaymentSignature(subscriptionId, paymentId, expected)).toBe(true);
  });

  it('returns false for invalid subscription signature', () => {
    expect(verifySubscriptionPaymentSignature('sub_ABC', 'pay_XYZ', 'bad')).toBe(false);
  });
});

describe('verifyWebhookSignature', () => {
  it('payment-hmac-integrity-ok: returns true for a valid webhook signature', () => {
    const raw = '{"event":"payment.captured"}';
    const expected = crypto.createHmac('sha256', 'whsec_456').update(raw).digest('hex');

    expect(verifyWebhookSignature(raw, expected)).toBe(true);
    console.log('payment-hmac-integrity-ok');
  });

  it('returns false for an invalid webhook signature', () => {
    expect(verifyWebhookSignature('body', 'bad')).toBe(false);
  });

  it('returns false when webhookSecret is not configured', () => {
    mockConfig.razorpay.webhookSecret = '';
    const raw = '{"event":"payment.captured"}';
    const expected = crypto.createHmac('sha256', 'whsec_456').update(raw).digest('hex');

    expect(verifyWebhookSignature(raw, expected)).toBe(false);
  });

  it('returns false for empty signature', () => {
    expect(verifyWebhookSignature('body', '')).toBe(false);
  });
});

describe('createRazorpayOrder', () => {
  it('sends correct payload to Razorpay API', async () => {
    const mockResponse = { id: 'order_123', amount: 399900, currency: 'INR' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await createRazorpayOrder({
      amountPaise: 399900,
      receipt: 'receipt_1',
      notes: { plan: 'growth' },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.razorpay.com/v1/orders');
    expect(opts?.method).toBe('POST');

    const parsed = JSON.parse(opts?.body as string);
    expect(parsed.amount).toBe(399900);
    expect(parsed.currency).toBe('INR');
    expect(parsed.receipt).toBe('receipt_1');
    expect(parsed.notes).toEqual({ plan: 'growth' });

    const auth = (opts?.headers as Record<string, string>)['Authorization'];
    const decoded = Buffer.from(auth.replace('Basic ', ''), 'base64').toString();
    expect(decoded).toBe('rzp_test_abc:secret_123');

    expect(result).toEqual(mockResponse);
    fetchSpy.mockRestore();
  });

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad request'),
    } as Response);

    await expect(
      createRazorpayOrder({ amountPaise: 100, receipt: 'r1' })
    ).rejects.toThrow('Failed to create payment order');
  });

  it('throws 503 when Razorpay is not configured', async () => {
    mockConfig.razorpay.keyId = '';
    mockConfig.razorpay.keySecret = '';

    await expect(
      createRazorpayOrder({ amountPaise: 100, receipt: 'r1' })
    ).rejects.toThrow('Payment gateway is not configured');
  });

  it('sends request without notes when notes are omitted', async () => {
    const mockResponse = { id: 'order_456', amount: 100, currency: 'INR' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    await createRazorpayOrder({ amountPaise: 100, receipt: 'r2' });

    const parsed = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(parsed.notes).toBeUndefined();
    fetchSpy.mockRestore();
  });
});

describe('verifyCapturedPayment', () => {
  it('payment-provider-verify-ok: accepts exact captured provider evidence', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const href = String(url);
      if (href.endsWith('/orders/order_ABC')) {
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'order_ABC',
              amount: 249900,
              currency: 'INR',
              status: 'paid',
            }),
        } as Response;
      }
      if (href.endsWith('/payments/pay_XYZ')) {
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'pay_XYZ',
              order_id: 'order_ABC',
              amount: 249900,
              currency: 'INR',
              status: 'captured',
            }),
        } as Response;
      }
      throw new Error(`unexpected fetch ${href}`);
    });

    const result = await verifyCapturedPayment({
      orderId: 'order_ABC',
      paymentId: 'pay_XYZ',
      amountPaise: 249900,
      currency: 'INR',
    });

    expect(result.order.status).toBe('paid');
    expect(result.payment.status).toBe('captured');
    console.log('payment-provider-verify-ok');
    fetchSpy.mockRestore();
  });

  it('rejects amount or currency mismatch before capture', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const href = String(url);
      if (href.endsWith('/orders/order_ABC')) {
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'order_ABC',
              amount: 249900,
              currency: 'INR',
              status: 'paid',
            }),
        } as Response;
      }
      return {
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'pay_XYZ',
            order_id: 'order_ABC',
            amount: 100,
            currency: 'INR',
            status: 'captured',
          }),
      } as Response;
    });

    await expect(
      verifyCapturedPayment({
        orderId: 'order_ABC',
        paymentId: 'pay_XYZ',
        amountPaise: 249900,
        currency: 'INR',
      })
    ).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
    fetchSpy.mockRestore();
  });

  it('returns verification pending when provider has not captured yet', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const href = String(url);
      if (href.endsWith('/orders/order_ABC')) {
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'order_ABC',
              amount: 249900,
              currency: 'INR',
              status: 'created',
            }),
        } as Response;
      }
      return {
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'pay_XYZ',
            order_id: 'order_ABC',
            amount: 249900,
            currency: 'INR',
            status: 'authorized',
          }),
      } as Response;
    });

    await expect(
      verifyCapturedPayment({
        orderId: 'order_ABC',
        paymentId: 'pay_XYZ',
        amountPaise: 249900,
        currency: 'INR',
      })
    ).rejects.toMatchObject({ code: 'VERIFICATION_PENDING' });
    fetchSpy.mockRestore();
  });
});

describe('activatePlan', () => {
  it('updates organization with plan, expiry ~30 days out, and active status', async () => {
    orgFindUnique.mockResolvedValue({ planExpiresAt: null } as never);
    orgUpdate.mockResolvedValue({} as never);

    await activatePlan('org-1', 'growth');

    expect(orgUpdate).toHaveBeenCalledTimes(1);
    const args = orgUpdate.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'org-1' });
    expect(args.data.plan).toBe('growth');
    expect(args.data.subscriptionStatus).toBe('active');

    const expiry = args.data.planExpiresAt as Date;
    const now = new Date();
    const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(29);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  it('works with different plan IDs', async () => {
    orgFindUnique.mockResolvedValue({ planExpiresAt: null } as never);
    orgUpdate.mockResolvedValue({} as never);

    await activatePlan('org-2', 'business');

    const args = orgUpdate.mock.calls[0][0];
    expect(args.data.plan).toBe('business');
    expect(args.where).toEqual({ id: 'org-2' });
  });

  it('propagates Prisma errors', async () => {
    orgFindUnique.mockResolvedValue({ planExpiresAt: null } as never);
    orgUpdate.mockRejectedValue(new Error('DB connection lost'));

    await expect(activatePlan('org-1', 'starter')).rejects.toThrow('DB connection lost');
  });
});
