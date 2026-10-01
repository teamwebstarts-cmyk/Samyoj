import { describe, expect, it } from 'vitest';
import { keywordMatches, wantsHandoff, isUnsafeKeywordRegex } from './trigger-match';

describe('keywordMatches', () => {
  it('matches whole words, not substrings', () => {
    expect(keywordMatches('What is the price?', { keyword: 'price' })).toBe(true);
    expect(keywordMatches('hello', { keyword: 'price' })).toBe(false);
    expect(keywordMatches('that looks pricey', { keyword: 'price' })).toBe(false);
  });

  it('ignores letter case and matches emoji triggers', () => {
    expect(keywordMatches('OFFER please', { keyword: 'Offer' })).toBe(true);
    expect(keywordMatches('offer🔥', { keyword: 'offer' })).toBe(true);
    expect(keywordMatches('offering', { keyword: 'offer' })).toBe(false);
    expect(keywordMatches('this 🔥', { keyword: '🔥' })).toBe(true);
    expect(keywordMatches('hello', { keyword: '🔥' })).toBe(false);
    expect(keywordMatches('❤️ love', { keyword: '❤' })).toBe(true);
  });

  it('supports exact and regex flags', () => {
    expect(keywordMatches('demo', { keyword: 'demo', exactMatch: true })).toBe(true);
    expect(keywordMatches('demo please', { keyword: 'demo', exactMatch: true })).toBe(false);
    expect(keywordMatches('order-123', { keyword: '^order-\\d+$', regex: true })).toBe(true);
    expect(keywordMatches('aaaa', { keyword: '(a+)+', regex: true })).toBe(false);
  });
});

describe('isUnsafeKeywordRegex', () => {
  it('rejects nested quantifiers and overlong patterns', () => {
    expect(isUnsafeKeywordRegex('(a+)+')).toBe(true);
    expect(isUnsafeKeywordRegex('a'.repeat(81))).toBe(true);
    expect(isUnsafeKeywordRegex('^order-\\d+$')).toBe(false);
  });
});

describe('wantsHandoff', () => {
  it('recognizes explicit human requests', () => {
    expect(wantsHandoff('talk to an agent')).toBe(true);
    expect(wantsHandoff('human please')).toBe(true);
    expect(wantsHandoff('talk to someone')).toBe(true);
  });

  it('does not treat agency as agent', () => {
    expect(wantsHandoff('which agency should I contact?')).toBe(false);
  });
});
