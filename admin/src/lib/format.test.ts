import { describe, expect, it } from 'vitest';
import { formatAgo, formatAiCapPercent } from './format';
import { OUTREACH_AGING_BUCKETS } from './templates';

describe('admin honesty helpers', () => {
  it('shows AI percent of cap and does not invent a cap', () => {
    expect(formatAiCapPercent(25, 100)).toBe('25% of cap');
    expect(formatAiCapPercent(12, null)).toBe('12 · no cap');
  });

  it('keeps outreach aging buckets at 7/14/30 days', () => {
    expect(OUTREACH_AGING_BUCKETS.map((row) => row.id)).toEqual(['d7', 'd14', 'd30', 'recent']);
  });

  it('formats relative time and falls back to a date / dash', () => {
    expect(formatAgo(null)).toBe('—');
    expect(formatAgo('not-a-date')).toBe('—');
    expect(formatAgo(new Date())).toBe('just now');
    expect(formatAgo(new Date(Date.now() - 5 * 60 * 1000))).toBe('5m ago');
    expect(formatAgo(new Date(Date.now() - 3 * 60 * 60 * 1000))).toBe('3h ago');
    expect(formatAgo(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))).toBe('2d ago');
    expect(formatAgo(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))).not.toBe('—');
  });
});
