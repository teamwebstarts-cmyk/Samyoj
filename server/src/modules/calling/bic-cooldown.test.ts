import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BIC_MAX_UNANSWERED,
  isBicInUnansweredCooldown,
  nextBicUnansweredCount,
} from './bic-cooldown';

describe('nextBicUnansweredCount', () => {
  it('increments on unanswered and resets on answer/connect', () => {
    expect(nextBicUnansweredCount(0, 'unanswered')).toBe(1);
    expect(nextBicUnansweredCount(1, 'unanswered')).toBe(2);
    expect(nextBicUnansweredCount(2, 'answered')).toBe(0);
    expect(nextBicUnansweredCount(2, 'connected')).toBe(0);
  });
});

describe('isBicInUnansweredCooldown', () => {
  const now = new Date('2026-08-08T12:00:00.000Z');

  it('allows dialing below the unanswered threshold', () => {
    expect(
      isBicInUnansweredCooldown({
        consecutiveUnanswered: DEFAULT_BIC_MAX_UNANSWERED - 1,
        lastUnansweredAt: now,
        now,
      })
    ).toBe(false);
  });

  it('blocks while cooldown window is active after threshold', () => {
    const lastUnansweredAt = new Date(now.getTime() - 60 * 60 * 1000);
    expect(
      isBicInUnansweredCooldown({
        consecutiveUnanswered: DEFAULT_BIC_MAX_UNANSWERED,
        lastUnansweredAt,
        cooldownMs: 24 * 60 * 60 * 1000,
        now,
      })
    ).toBe(true);
  });

  it('allows dialing again after cooldown elapses', () => {
    const lastUnansweredAt = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    expect(
      isBicInUnansweredCooldown({
        consecutiveUnanswered: 3,
        lastUnansweredAt,
        cooldownMs: 24 * 60 * 60 * 1000,
        now,
      })
    ).toBe(false);
  });
});
