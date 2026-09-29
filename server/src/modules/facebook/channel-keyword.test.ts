import { describe, expect, it } from 'vitest';
import { matchChannelKeyword, matchChannelRule, matchInstagramCommentReplies } from './channel-keyword';

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

  it('does not use an Instagram comment rule for a DM', () => {
    expect(
      matchChannelKeyword(
        [
          {
            triggerType: 'KEYWORD',
            config: {
              platform: 'IG',
              keyword: 'PRICE',
              message: 'comment private reply',
              publicMessage: 'Check your DMs',
              igMediaId: 'media_1',
            },
          },
          { config: { platform: 'IG', keyword: 'HELP', response: 'DM help' } },
        ],
        'IG',
        'PRICE',
      ),
    ).toBeNull();
  });

  it('takes the oldest private text and the oldest public text', () => {
    const replies = matchInstagramCommentReplies(
      [
        { triggerType: 'KEYWORD', config: { platform: 'IG', keyword: 'PRICE', publicMessage: 'Check your DMs' } },
        { triggerType: 'KEYWORD', config: { platform: 'IG', keyword: 'PRICE', message: '₹999' } },
      ],
      'PRICE please'
    );
    expect(replies).toEqual({ privateText: '₹999', publicText: 'Check your DMs' });
  });

  it('uses the rule for this post before a rule for every post', () => {
    const replies = matchInstagramCommentReplies(
      [
        {
          triggerType: 'KEYWORD',
          config: { platform: 'IG', keyword: 'PRICE', message: 'any post', publicMessage: 'any' },
        },
        {
          triggerType: 'KEYWORD',
          config: {
            platform: 'IG',
            keyword: 'PRICE',
            igMediaId: 'media_1',
            message: 'this post dm',
            publicMessage: 'this post reply',
          },
        },
      ],
      'PRICE',
      'media_1'
    );
    expect(replies).toEqual({ privateText: 'this post dm', publicText: 'this post reply' });
    expect(
      matchInstagramCommentReplies(
        [
          {
            triggerType: 'KEYWORD',
            config: {
              platform: 'IG',
              keyword: 'PRICE',
              igMediaId: 'media_1',
              message: 'this post dm',
            },
          },
        ],
        'PRICE',
        'media_2'
      ).privateText
    ).toBeNull();
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
