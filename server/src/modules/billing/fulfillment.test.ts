import { describe, it, expect } from 'vitest';
import { parseTopupQuantity } from './fulfillment';

describe('fulfillment top-up quantity', () => {
  it('one-pack-topup-ok: defaults to one fixed pack per checkout', () => {
    expect(parseTopupQuantity(undefined)).toBe(1);
    expect(parseTopupQuantity('monthly')).toBe(1);
    expect(parseTopupQuantity('topup:0')).toBe(1);
    console.log('one-pack-topup-ok');
  });

  it('parses legacy topup:N cadence for reconciliation only', () => {
    expect(parseTopupQuantity('topup:3')).toBe(3);
    expect(parseTopupQuantity('topup:99')).toBe(99);
  });
});
