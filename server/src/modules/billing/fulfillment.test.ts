import { describe, it, expect } from 'vitest';
import { parseTopupQuantity } from './fulfillment';

describe('fulfillment top-up quantity', () => {
  it('parses topup:N cadence', () => {
    expect(parseTopupQuantity('topup:3')).toBe(3);
    expect(parseTopupQuantity('topup:99')).toBe(99);
    expect(parseTopupQuantity('topup:0')).toBe(1);
    expect(parseTopupQuantity('monthly')).toBe(1);
    console.log('parses topup:N cadence');
  });
});
