import { describe, expect, it } from 'vitest';
import { matchChannelKeyword } from './channel-keyword';

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
});
