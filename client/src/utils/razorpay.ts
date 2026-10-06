declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      scriptPromise = null;
      reject(new Error('Failed to load Razorpay'));
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}

/** Ask Checkout for every INR instrument. Subscriptions still only show mandate methods Razorpay allows. */
export function razorpayCheckoutConfig(kind: 'order' | 'subscription' = 'order') {
  const blocks = {
    upi: { name: 'UPI', instruments: [{ method: 'upi' }] },
    card: { name: 'Cards', instruments: [{ method: 'card' }] },
    netbanking: { name: 'Netbanking', instruments: [{ method: 'netbanking' }] },
    ...(kind === 'order'
      ? { wallet: { name: 'Wallets', instruments: [{ method: 'wallet' }] } }
      : {}),
  };
  return {
    display: {
      blocks,
      sequence: [
        'block.upi',
        'block.card',
        'block.netbanking',
        ...(kind === 'order' ? ['block.wallet'] : []),
      ],
      preferences: { show_default_blocks: true },
    },
  };
}

export function razorpayMethodFlags(kind: 'order' | 'subscription' = 'order') {
  return {
    upi: true,
    card: true,
    netbanking: true,
    wallet: kind === 'order',
  };
}

export function isRazorpayTestKey(keyId: string | null | undefined): boolean {
  return Boolean(keyId && keyId.startsWith('rzp_test_'));
}

export interface RazorpayCheckoutOptions {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefillName?: string;
  prefillEmail?: string;
  onSuccess: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  onDismiss?: () => void;
  onFailure?: (response: { error?: { description?: string; reason?: string } }) => void;
}

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions) {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error('Razorpay unavailable');

  const rzp = new window.Razorpay({
    key: options.keyId,
    amount: options.amount,
    currency: options.currency,
    name: options.name,
    description: options.description,
    order_id: options.orderId,
    prefill: {
      ...(options.prefillName ? { name: options.prefillName } : {}),
      ...(options.prefillEmail ? { email: options.prefillEmail } : {}),
    },
    method: razorpayMethodFlags('order'),
    config: razorpayCheckoutConfig('order'),
    theme: { color: '#25D366' },
    handler: options.onSuccess,
    modal: {
      ondismiss: options.onDismiss,
    },
  });

  rzp.on('payment.failed', (response: unknown) => {
    options.onFailure?.(response as { error?: { description?: string; reason?: string } });
  });

  rzp.open();
}

export interface RazorpaySubscriptionCheckoutOptions {
  keyId: string;
  subscriptionId: string;
  name: string;
  description: string;
  prefillName?: string;
  prefillEmail?: string;
  onSuccess: (response: {
    razorpay_subscription_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  onDismiss?: () => void;
  onFailure?: (response: { error?: { description?: string; reason?: string } }) => void;
}

export async function openRazorpaySubscriptionCheckout(
  options: RazorpaySubscriptionCheckoutOptions
) {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error('Razorpay unavailable');

  const rzp = new window.Razorpay({
    key: options.keyId,
    subscription_id: options.subscriptionId,
    name: options.name,
    description: options.description,
    prefill: {
      ...(options.prefillName ? { name: options.prefillName } : {}),
      ...(options.prefillEmail ? { email: options.prefillEmail } : {}),
    },
    method: razorpayMethodFlags('subscription'),
    config: razorpayCheckoutConfig('subscription'),
    theme: { color: '#25D366' },
    handler: options.onSuccess,
    modal: {
      ondismiss: options.onDismiss,
    },
  });

  rzp.on('payment.failed', (response: unknown) => {
    options.onFailure?.(response as { error?: { description?: string; reason?: string } });
  });

  rzp.open();
}
