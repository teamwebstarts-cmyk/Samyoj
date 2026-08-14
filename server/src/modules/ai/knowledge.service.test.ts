import { describe, expect, it } from 'vitest';
import {
  EMBEDDING_MATCH_THRESHOLD,
  expandKnowledgeQuery,
  formatKnowledgeContext,
  tokenSearch,
} from './knowledge.service';

describe('tokenSearch', () => {
  const items = [
    { id: '1', title: 'Business hours', content: 'We are open 9 AM to 6 PM', sourceType: 'FAQ' },
    { id: '2', title: 'Refund policy', content: 'Refunds take 5 to 7 days', sourceType: 'FAQ' },
  ];

  it('returns empty when query has no tokens', () => {
    expect(tokenSearch(items, '   ', 5)).toEqual([]);
    expect(tokenSearch(items, '', 5)).toEqual([]);
  });

  it('does not dump latest FAQs when nothing matches', () => {
    const result = tokenSearch(items, 'Nike T-shirt discount code', 5);
    expect(result).toEqual([]);
  });

  it('ranks matching items above non-matching', () => {
    const result = tokenSearch(items, 'refund', 5);
    expect(result[0].id).toBe('2');
    expect(result[0].score).toBeGreaterThan(0);
  });

  it('matches Hindi query tokens to the Hindi FAQ', () => {
    const hindiItems = [
      { id: 'refund', title: 'Refund', content: 'Refunds take 5 days', sourceType: 'FAQ' },
      {
        id: 'hours',
        title: 'व्यवसाय समय',
        content: 'सुबह 9 बजे से शाम 6 बजे तक खुला',
        sourceType: 'FAQ',
      },
      { id: 'ship', title: 'Shipping', content: 'Ships in 3 days', sourceType: 'FAQ' },
    ];
    const result = tokenSearch(hindiItems, 'समय क्या है', 5);
    expect(result[0].id).toBe('hours');
    expect(result[0].score).toBeGreaterThan(1);
  });

  it('keeps Devanagari combining marks so Hindi compounds still match', () => {
    const hindiItems = [
      { id: 'refund', title: 'Refund', content: 'Refunds take 5 days', sourceType: 'FAQ' },
      {
        id: 'hours',
        title: 'व्यवसाय समय',
        content: 'सुबह 9 बजे से शाम 6 बजे तक खुला हैं',
        sourceType: 'FAQ',
      },
    ];
    const result = tokenSearch(hindiItems, 'खुले हैं', 5);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('hours');
  });

  it('ranks Hindi timing queries after expandKnowledgeQuery aliases', () => {
    const hindiItems = [
      { id: 'refund', title: 'Refund', content: 'Refunds take 5 days', sourceType: 'FAQ' },
      {
        id: 'hours',
        title: 'व्यवसाय समय',
        content: 'सुबह 9 बजे से शाम 6 बजे तक खुला',
        sourceType: 'FAQ',
      },
      { id: 'ship', title: 'Shipping', content: 'Ships in 3 days', sourceType: 'FAQ' },
    ];
    const expanded = expandKnowledgeQuery('समय क्या है');
    expect(expanded).toMatch(/timing|hours/i);
    const result = tokenSearch(hindiItems, expanded, 5);
    expect(result[0].id).toBe('hours');
    expect(result[0].score).toBeGreaterThan(0);
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      title: `item ${i}`,
      content: 'common word here',
      sourceType: 'FAQ' as const,
    }));
    expect(tokenSearch(many, 'common', 3)).toHaveLength(3);
  });
});

describe('expandKnowledgeQuery', () => {
  it('adds hours aliases for spoken timing questions', () => {
    expect(expandKnowledgeQuery('shop timing kya hai')).toMatch(/hours/i);
  });

  it('lets tokenSearch rank hours FAQs from a timing query', () => {
    const items = [
      { id: '1', title: 'Business hours', content: 'We are open 9 AM to 6 PM', sourceType: 'FAQ' },
      { id: '2', title: 'Refund policy', content: 'Refunds take 5 to 7 days', sourceType: 'FAQ' },
    ];
    const result = tokenSearch(items, expandKnowledgeQuery('shop timing kya hai'), 5);
    expect(result[0].id).toBe('1');
    expect(result.map((r) => r.id)).not.toContain('2');
  });
});

describe('formatKnowledgeContext', () => {
  it('returns empty string for no matches', () => {
    expect(formatKnowledgeContext([])).toBe('');
  });

  it('tags non-FAQ sources', () => {
    const ctx = formatKnowledgeContext([
      { id: '1', title: 'Hours', content: '9-6', sourceType: 'URL', score: 1 },
      { id: '2', title: 'Policy', content: 'yes', sourceType: 'FAQ', score: 1 },
    ]);
    expect(ctx).toContain('[URL]');
    expect(ctx).not.toContain('[FAQ]');
    expect(ctx).toContain('Q1 [URL]: Hours');
  });
});

describe('EMBEDDING_MATCH_THRESHOLD', () => {
  it('is a sane similarity cutoff', () => {
    expect(EMBEDDING_MATCH_THRESHOLD).toBeGreaterThan(0);
    expect(EMBEDDING_MATCH_THRESHOLD).toBeLessThanOrEqual(1);
  });
});
