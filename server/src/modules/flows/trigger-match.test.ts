import { describe, expect, it } from 'vitest';
import { keywordMatches, wantsHandoff } from './trigger-match';

describe('keywordMatches', () => {
  it('matches whole words, not substrings', () => {
    expect(keywordMatches('What is the price?', { keyword: 'price' })).toBe(true);
    expect(keywordMatches('hello', { keyword: 'price' })).toBe(false);
    expect(keywordMatches('that looks pricey', { keyword: 'price' })).toBe(false);
  });

  it('supports exact and regex flags', () => {
    expect(keywordMatches('demo', { keyword: 'demo', exactMatch: true })).toBe(true);
    expect(keywordMatches('demo please', { keyword: 'demo', exactMatch: true })).toBe(false);
    expect(keywordMatches('order-123', { keyword: '^order-\\d+$', regex: true })).toBe(true);
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
