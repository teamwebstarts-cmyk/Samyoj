import { describe, expect, it } from 'vitest';
import {
  EMBEDDING_MATCH_THRESHOLD,
  expandKnowledgeQuery,
  formatKnowledgeContext,
  isConversationRecallQuestion,
  tokenSearch,
  validateTrainText,
  voiceKnowledgeQueries,
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

  it('does not inject order FAQs into a generic help question', () => {
    const expanded = expandKnowledgeQuery('mujhe help chahiye automation mein');
    expect(expanded).toMatch(/automation/i);
    expect(expanded).not.toMatch(/\border\b/);
  });

  it('adds business and services aliases for company questions', () => {
    expect(expandKnowledgeQuery('kaun si services hai')).toMatch(/services/i);
    expect(expandKnowledgeQuery('tell me about your business')).toMatch(/business/i);
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

describe('isConversationRecallQuestion', () => {
  it('detects name and recap questions', () => {
    expect(isConversationRecallQuestion('Mera naam yaad hai?')).toBe(true);
    expect(isConversationRecallQuestion('Do you know me?')).toBe(true);
    expect(isConversationRecallQuestion('तुमने पीछे कुछ बोला था')).toBe(true);
    expect(isConversationRecallQuestion('What did you just say')).toBe(true);
  });

  it('does not treat a real FAQ question as recall', () => {
    expect(isConversationRecallQuestion('order status kya hai')).toBe(false);
    expect(isConversationRecallQuestion('automation mein help chahiye')).toBe(false);
  });
});

describe('voiceKnowledgeQueries', () => {
  it('returns nothing for a recall / about-me turn so FAQs are not dumped', () => {
    expect(
      voiceKnowledgeQueries('Mera naam yaad hai?', [
        { role: 'assistant', content: 'Hi Nirbhay.' },
        { role: 'user', content: 'Store pickup kaise kare?' },
      ])
    ).toEqual([]);
  });

  it('retries the previous caller turn when the current STT is a short follow-up', () => {
    expect(
      voiceKnowledgeQueries('haan woh hi', [
        { role: 'user', content: 'shop timing kya hai' },
        { role: 'assistant', content: 'We open at 9.' },
      ])
    ).toEqual(['haan woh hi', 'shop timing kya hai']);
  });

  it('combines prior business question with a services follow-up', () => {
    expect(
      voiceKnowledgeQueries('kaun si services hai', [
        { role: 'user', content: 'business ke bare mein batao' },
        { role: 'assistant', content: 'We offer WhatsApp automation.' },
      ])
    ).toEqual([
      'business ke bare mein batao kaun si services hai',
      'kaun si services hai',
      'business ke bare mein batao',
      'We offer WhatsApp automation. kaun si services hai',
    ]);
  });
});

describe('validateTrainText', () => {
  it('allows a short Q&A', () => {
    expect(validateTrainText('Hours', 'We open 9 to 6.')).toBeNull();
  });

  it('rejects empty junk', () => {
    expect(validateTrainText('H', 'ok')).toMatch(/title/i);
    expect(validateTrainText('Hours', 'no')).toMatch(/bit more/i);
  });
});
