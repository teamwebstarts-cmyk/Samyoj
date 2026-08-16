import { describe, expect, it } from 'vitest';
import { addCalendarDaysInTimeZone, nextRepeatInstant, shouldScheduleRepeat } from './timezone';

describe('campaign repeat wall-clock', () => {
  it('keeps 10:00 Asia/Kolkata when adding 2 days', () => {
    // 16 Aug 2026 10:00 IST = 04:30 UTC
    const start = new Date('2026-08-16T04:30:00.000Z');
    const next = addCalendarDaysInTimeZone(start, 2, 'Asia/Kolkata');
    expect(next.toISOString()).toBe('2026-08-18T04:30:00.000Z');
  });

  it('uses last scheduled instant, not send-now clock, for the next run', () => {
    const next = nextRepeatInstant({
      lastScheduledAt: new Date('2026-08-16T04:30:00.000Z'),
      completedAt: new Date('2026-08-16T05:10:00.000Z'),
      intervalDays: 3,
      timeZone: 'Asia/Kolkata',
    });
    expect(next.toISOString()).toBe('2026-08-19T04:30:00.000Z');
  });

  it('stops at occurrence cap and until date', () => {
    const nextAt = new Date('2026-08-20T04:30:00.000Z');
    expect(
      shouldScheduleRepeat({
        repeatIntervalDays: 2,
        repeatOccurrenceCount: 2,
        repeatMaxOccurrences: 3,
        nextAt,
      })
    ).toBe(true);
    expect(
      shouldScheduleRepeat({
        repeatIntervalDays: 2,
        repeatOccurrenceCount: 3,
        repeatMaxOccurrences: 3,
        nextAt,
      })
    ).toBe(false);
    expect(
      shouldScheduleRepeat({
        repeatIntervalDays: 2,
        repeatOccurrenceCount: 1,
        repeatUntil: new Date('2026-08-19T04:30:00.000Z'),
        nextAt,
      })
    ).toBe(false);
  });
});
