import { describe, expect, it } from 'vitest';
import { generateMockAiDraft } from './TemplateEditorPage';

describe('generateMockAiDraft (AI assist bar mock)', () => {
  it('classifies marketing prompts and pairs every EN variable with the same HI index', () => {
    const s = generateMockAiDraft('Create a Diwali offer message for ecommerce customers. Give 20% discount using code DIWALI20. Keep it short.');
    expect(s.category).toBe('MARKETING');
    const enTokens = [...s.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]).sort();
    const hiTokens = [...s.bodyHi.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]).sort();
    expect(enTokens).toEqual(hiTokens);
    expect(enTokens.length).toBeGreaterThan(0);
    // Variables are indexed 1..n with no gaps.
    expect(s.variables.map((v) => v.index)).toEqual(s.variables.map((_, i) => i + 1));
    expect(s.buttons.length).toBeGreaterThan(0);
  });

  it('classifies OTP prompts as authentication without a marketing footer', () => {
    const s = generateMockAiDraft('Send a login verification code message');
    expect(s.category).toBe('AUTHENTICATION');
    expect(s.footer).toBe('');
    expect(s.variables[0]?.description).toBe('Code');
  });
});
