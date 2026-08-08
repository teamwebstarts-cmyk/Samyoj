import { describe, expect, it } from 'vitest';
import { getPendingTtl } from './session-store';

describe('getPendingTtl', () => {
  it('uses default floor of 180s for short ring timeouts', () => {
    expect(getPendingTtl(25)).toBe(180);
    expect(getPendingTtl()).toBe(180);
  });

  it('extends TTL when ring timeout exceeds the default floor', () => {
    expect(getPendingTtl(60)).toBe(180);
    expect(getPendingTtl(120)).toBe(180);
    expect(getPendingTtl(200)).toBe(205);
  });
});
