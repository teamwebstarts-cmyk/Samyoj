import { describe, expect, it } from 'vitest';
import { pickDefaultSupportBot, getHandoffKeywords, botDeleteBlockReason } from './bot.service';

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

describe('botDeleteBlockReason', () => {
  it('blocks the Support / system bot', () => {
    expect(botDeleteBlockReason({ isSystem: true, remainingInChannel: 3 })).toBe(
      'The Support bot cannot be deleted.'
    );
  });

  it('blocks deleting the last remaining bot on a channel', () => {
    expect(botDeleteBlockReason({ isSystem: false, remainingInChannel: 1 })).toBe(
      'Keep at least one bot for this channel.'
    );
  });

  it('allows deleting an extra non-system bot', () => {
    expect(botDeleteBlockReason({ isSystem: false, remainingInChannel: 2 })).toBeNull();
  });
});

describe('getHandoffKeywords', () => {
  it('returns platform defaults when the bot offers a person', () => {
    expect(getHandoffKeywords([], true).length).toBeGreaterThan(0);
  });

  it('returns nothing when the bot should not offer a person', () => {
    expect(getHandoffKeywords(['human'], false)).toEqual([]);
  });

  it('uses the bot’s own words when they are set', () => {
    expect(getHandoffKeywords(['talk to a person'], true)).toEqual(['talk to a person']);
  });
});
