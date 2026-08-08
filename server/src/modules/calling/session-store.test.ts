import { describe, expect, it } from 'vitest';
import { getPendingTtl } from './session-store';

describe('getPendingTtl', () => {
  it('uses default floor of 60s for short ring timeouts', () => {
    expect(getPendingTtl(25)).toBe(60);
    expect(getPendingTtl()).toBe(60);
  });

  it('extends TTL when ring timeout exceeds the default floor', () => {
    expect(getPendingTtl(60)).toBe(65);
    expect(getPendingTtl(120)).toBe(125);
  });
});
