import { describe, expect, it } from 'vitest';
import { formatAiCapPercent } from './format';
import { OUTREACH_AGING_BUCKETS } from './templates';

describe('admin honesty helpers', () => {
  it('shows AI percent of cap and does not invent a cap', () => {
    expect(formatAiCapPercent(25, 100)).toBe('25% of cap');
    expect(formatAiCapPercent(12, null)).toBe('12 · no cap');
  });

  it('keeps outreach aging buckets at 7/14/30 days', () => {
    expect(OUTREACH_AGING_BUCKETS.map((row) => row.id)).toEqual(['d7', 'd14', 'd30', 'recent']);
  });
});
