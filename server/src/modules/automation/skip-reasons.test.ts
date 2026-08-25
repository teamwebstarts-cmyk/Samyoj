import { describe, expect, it } from 'vitest';
import { aggregateSkipReasons, extractSkipReason, skipReasonLabel } from './skip-reasons';

describe('skip-reasons', () => {
  it('extracts explicit output reasons', () => {
    expect(
      extractSkipReason({
        status: 'skipped',
        action: 'send_reply',
        output: { reason: 'csw_closed' },
        error: null,
      })
    ).toBe('csw_closed');
  });

  it('maps frequency_cap action', () => {
    expect(
      extractSkipReason({
        status: 'skipped',
        action: 'frequency_cap',
        output: null,
        error: null,
      })
    ).toBe('frequency_cap');
  });

  it('aggregates skip reasons for analytics', () => {
    const bySkipReason = aggregateSkipReasons([
      { status: 'skipped', action: 'send_reply', output: { reason: 'csw_closed' }, error: null },
      { status: 'skipped', action: 'frequency_cap', output: null, error: null },
      { status: 'success', action: 'send_reply', output: null, error: null },
    ]);
    expect(bySkipReason).toEqual({ csw_closed: 1, frequency_cap: 1 });
  });

  it('labels known reasons for UI', () => {
    expect(skipReasonLabel('csw_closed')).toBe('24h window closed');
  });
});
