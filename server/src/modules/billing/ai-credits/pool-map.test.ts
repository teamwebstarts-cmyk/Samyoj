import { describe, expect, it } from 'vitest';
import { poolForAiAction, shouldDeductOnUsageLog } from './pool-map';

describe('AI usage pool mapping', () => {
  it('meters Instagram captions as chat credits', () => {
    expect(poolForAiAction('instagram_caption')).toBe('chat');
    expect(shouldDeductOnUsageLog('instagram_caption')).toBe(true);
  });

  it('does not charge tenant credits for internal support and call summaries', () => {
    expect(poolForAiAction('support_help')).toBeNull();
    expect(poolForAiAction('call_summary')).toBeNull();
    expect(shouldDeductOnUsageLog('support_help')).toBe(false);
    expect(shouldDeductOnUsageLog('call_summary')).toBe(false);
  });
});
