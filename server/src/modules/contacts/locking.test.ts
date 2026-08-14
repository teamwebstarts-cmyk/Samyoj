import { describe, expect, it } from 'vitest';
import { sortContactIdsForLock } from './locking';

describe('contact deletion lock ordering', () => {
  it('uses one deterministic order for overlapping bulk deletes', () => {
    const first = sortContactIdsForLock(['contact-b', 'contact-a', 'contact-c']);
    const second = sortContactIdsForLock(['contact-c', 'contact-b', 'contact-a']);

    expect(first).toEqual(['contact-a', 'contact-b', 'contact-c']);
    expect(second).toEqual(first);
  });
});
