import { describe, expect, it } from 'vitest';
import { AUDIT_SCORE, scoreAudit } from './audit-score';

describe('Facebook/Instagram audit recapture', () => {
  it('scores code against the audit and fails if a done item is missing', () => {
    const result = scoreAudit();
    // eslint-disable-next-line no-console
    console.log(result.line);
    expect(result.failures, result.failures.join('\n')).toEqual([]);
    expect(result.counts.done).toBe(19);
    expect(result.counts.remaining).toBe(1);
    expect(result.counts.out).toBe(5);
    expect(result.counts.live_unproven).toBe(2);
    expect(AUDIT_SCORE.some((item) => item.id === 'ADS-create' && item.verdict === 'out')).toBe(true);
    expect(result.line).toBe('SCORE done=19 remaining=1 out=5 live_unproven=2');
  });
});
