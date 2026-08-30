import { describe, expect, it } from 'vitest';
import { quoteFlexTopup } from './flexAiTopup';

describe('flexAiTopup', () => {
  it('matches Boost and Starter GST-inclusive rates', () => {
    expect(quoteFlexTopup('chat', 235).units).toBe(1000);
    expect(quoteFlexTopup('calling', 353).units).toBe(30);
    expect(quoteFlexTopup('chat', 10).spendInr).toBe(10);
    expect(quoteFlexTopup('calling', 1000).spendInr).toBe(1000);
  });
});
