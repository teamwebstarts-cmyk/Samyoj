import { describe, expect, it } from 'vitest';
import { pickDefaultSupportBot } from './bot.service';

describe('pickDefaultSupportBot', () => {
  const support = { id: 'support', enabled: true, isDefault: true };
  const other = { id: 'other', enabled: true, isDefault: false };
  const older = { id: 'older', enabled: true, isDefault: false };

  it('returns the org default even when another bot was created first', () => {
    expect(pickDefaultSupportBot([older, other, support])?.id).toBe('support');
  });

  it('prefers an enabled default over a disabled default', () => {
    expect(
      pickDefaultSupportBot([
        { ...support, enabled: false },
        other,
      ])?.id
    ).toBe('other');
  });

  it('returns the first enabled bot when no default flag exists', () => {
    expect(pickDefaultSupportBot([older, other])?.id).toBe('older');
  });

  it('returns null when there are no bots', () => {
    expect(pickDefaultSupportBot([])).toBeNull();
  });
});
