import { describe, expect, it } from 'vitest';
import { isRazorpayTestKey, razorpayCheckoutConfig, razorpayMethodFlags } from './razorpay';

describe('razorpay checkout methods', () => {
  it('puts UPI first and keeps card, netbanking, and wallet available', () => {
    const order = razorpayCheckoutConfig('order');
    expect(order.display.sequence[0]).toBe('block.upi');
    expect(order.display.sequence).toEqual([
      'block.upi',
      'block.card',
      'block.netbanking',
      'block.wallet',
    ]);
    expect(order.display.preferences.show_default_blocks).toBe(true);
    expect(razorpayMethodFlags('order')).toEqual({
      upi: true,
      card: true,
      netbanking: true,
      wallet: true,
    });

    const subscription = razorpayCheckoutConfig('subscription');
    expect(subscription.display.sequence).toEqual(['block.upi', 'block.card', 'block.netbanking']);
    expect(razorpayMethodFlags('subscription').upi).toBe(true);
    expect(razorpayMethodFlags('subscription').wallet).toBe(false);
    expect(isRazorpayTestKey('rzp_test_example')).toBe(true);
    expect(isRazorpayTestKey('rzp_live_example')).toBe(false);
  });
});
