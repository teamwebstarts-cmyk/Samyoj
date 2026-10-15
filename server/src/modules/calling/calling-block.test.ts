import { describe, expect, it } from 'vitest';
import { callingBlockNotice } from './calling-block';

describe('callingBlockNotice', () => {
  it('names the current daily limit when Meta is still under 2,000', () => {
    const notice = callingBlockNotice('TIER_250');
    expect(notice.code).toBe('META_CALLING_LIMIT');
    expect(notice.message).toMatch(/2,000/);
    expect(notice.message).toMatch(/250/);
    expect(notice.message).not.toMatch(/138015|TIER_/);
  });

  it('does not blame the limit once the number is already at 2,000 or more', () => {
    const notice = callingBlockNotice('TIER_10K');
    expect(notice.code).toBe('META_CALLING_OFF');
    expect(notice.message).not.toMatch(/at 10,000/);
    expect(notice.message).toMatch(/WhatsApp Manager/);
  });

  it('still explains an unknown limit without a raw code', () => {
    const notice = callingBlockNotice(null);
    expect(notice.message).toMatch(/2,000/);
    expect(notice.message).not.toMatch(/138015/);
  });
});
