import { describe, expect, it } from 'vitest';
import {
  publicKnowledgeHasEmbedding,
  resolveAiBotTestChannel,
  sanitizeAiBotTestHistory,
} from './test-preview';

describe('resolveAiBotTestChannel', () => {
  it('uses the chat model for chat bots', () => {
    expect(resolveAiBotTestChannel('CHAT')).toBe('text');
    expect(resolveAiBotTestChannel(undefined)).toBe('text');
  });

  it('uses the calling brain for calling bots', () => {
    expect(resolveAiBotTestChannel('CALL')).toBe('voice');
  });
});

describe('sanitizeAiBotTestHistory', () => {
  it('keeps only user/assistant turns with text', () => {
    expect(
      sanitizeAiBotTestHistory([
        { role: 'user', content: 'Hours?' },
        { role: 'system', content: 'ignore' },
        { role: 'assistant', content: '  9 to 6  ' },
        { role: 'user', content: '' },
      ])
    ).toEqual([
      { role: 'user', content: 'Hours?' },
      { role: 'assistant', content: '9 to 6' },
    ]);
  });

  it('caps history so a long Try-it session cannot dump a novel', () => {
    const history = Array.from({ length: 40 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `turn ${i}`,
    }));
    expect(sanitizeAiBotTestHistory(history)).toHaveLength(12);
  });
});

describe('publicKnowledgeHasEmbedding', () => {
  it('is Ready only when a vector actually exists', () => {
    expect(publicKnowledgeHasEmbedding([0.1, 0.2])).toBe(true);
    expect(publicKnowledgeHasEmbedding([])).toBe(false);
    expect(publicKnowledgeHasEmbedding(null)).toBe(false);
  });
});
