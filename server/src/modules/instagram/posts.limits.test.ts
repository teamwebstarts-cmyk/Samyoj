import { describe, expect, it } from 'vitest';
import { assertCaption, assertScheduleWindow, countHashtags } from './posts.limits';

describe('instagram post limits', () => {
  it('counts hashtags', () => {
    expect(countHashtags('Hello #Sale #Diwali')).toBe(2);
  });

  it('rejects too many hashtags', () => {
    const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' ');
    expect(() => assertCaption(tags)).toThrow(/hashtags/i);
  });

  it('rejects a schedule inside 10 minutes', () => {
    const soon = new Date(Date.now() + 2 * 60 * 1000);
    expect(() => assertScheduleWindow(soon)).toThrow(/10 minutes/i);
  });
});
