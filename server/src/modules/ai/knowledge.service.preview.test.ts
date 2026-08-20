import { describe, expect, it } from 'vitest';
import { matchPreviewKnowledge, mergeKnowledgeMatches } from './knowledge.service';

describe('mergeKnowledgeMatches', () => {
  it('dedupes by title and caps count', () => {
    const merged = mergeKnowledgeMatches(
      [{ id: '1', title: 'Hours', content: '9–6', score: 2 }],
      [{ id: '2', title: 'hours', content: 'dup', score: 1 }],
      3
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].content).toBe('9–6');
  });
});

describe('matchPreviewKnowledge', () => {
  it('returns token matches when possible', () => {
    const matches = matchPreviewKnowledge(
      [{ title: 'Opening hours', content: 'We open at 9 AM.' }],
      'What are your hours?'
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].title).toBe('Opening hours');
  });

  it('falls back to all preview rows when nothing matches', () => {
    const matches = matchPreviewKnowledge(
      [{ title: 'Delivery', content: 'Same-day in Pune.' }],
      'random unrelated'
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].content).toContain('Pune');
  });
});
