import { describe, expect, it } from 'vitest';
import { AppError } from '../../../errors';
import { nextMeteringStatus } from './service';

describe('nextMeteringStatus', () => {
  it('stops retrying when the org has no AI credits', () => {
    const err = new AppError(429, 'AI credits exhausted', 'AI_CREDITS_EXHAUSTED');
    expect(nextMeteringStatus(err, 1)).toBe('FAILED');
    expect(nextMeteringStatus(new Error('AI calling minutes exhausted.'), 1)).toBe('FAILED');
  });

  it('keeps retrying a transient failure, then stops', () => {
    expect(nextMeteringStatus(new Error('database timeout'), 3)).toBe('PENDING_RETRY');
    expect(nextMeteringStatus(new Error('database timeout'), 8)).toBe('FAILED');
  });
});
