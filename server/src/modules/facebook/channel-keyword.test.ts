import { describe, expect, it } from 'vitest';
import { matchChannelKeyword, matchChannelRule } from './channel-keyword';

describe('matchChannelKeyword', () => {
  const rows = [
    { config: { platform: 'IG', keyword: 'PRICE', response: 'IG price' } },
    { config: { platform: 'FB', keyword: 'PRICE', response: 'FB price' } },
  ];

  it('uses the Facebook rule for a Messenger DM', () => {
    expect(matchChannelKeyword(rows, 'FB', 'what is the PRICE')).toBe('FB price');
  });

  it('does not use a WhatsApp-shaped rule', () => {
    expect(matchChannelKeyword([{ config: { keyword: 'PRICE', response: 'WA' } }], 'IG', 'PRICE')).toBeNull();
  });

  it('uses the Facebook welcome on a new chat and not the Instagram welcome', () => {
    const rows = [
      { triggerType: 'WELCOME', config: { platform: 'IG', message: 'IG hi' } },
      { triggerType: 'WELCOME', config: { platform: 'FB', message: 'FB hi' } },
    ];
    expect(matchChannelRule(rows, 'FB', { text: 'hello', isNew: true, withinHours: true })).toBe('FB hi');
    expect(matchChannelRule(rows, 'FB', { text: 'hello', isNew: false, withinHours: true })).toBeNull();
  });

  it('uses the away reply only outside hours', () => {
    const rows = [{ triggerType: 'AWAY', config: { platform: 'IG', message: 'later' } }];
    expect(matchChannelRule(rows, 'IG', { text: 'hi', isNew: false, withinHours: false })).toBe('later');
    expect(matchChannelRule(rows, 'IG', { text: 'hi', isNew: false, withinHours: true })).toBeNull();
  });
});
