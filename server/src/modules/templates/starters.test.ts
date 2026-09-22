import { describe, expect, it } from 'vitest';
import { listSamyojStarters, starterCreatePayload } from './catalog';
import { createTemplateSchema, templateTextHasEdgeParams } from './types';

describe('Samyoj catalog templates', () => {
  it('ships exactly five curated bilingual drafts', () => {
    const starters = listSamyojStarters();
    expect(starters).toHaveLength(5);
    const ids = new Set(starters.map((row) => row.id));
    expect(ids).toEqual(
      new Set(['hello_reply', 'hello_welcome', 'party_invitation', 'marketing_update', 'modern_status']),
    );
    for (const starter of starters) {
      expect(starter.languages).toEqual(['en_US', 'hi_IN']);
      expect(starter.bodyHi.length).toBeGreaterThan(8);
      expect(starter.body).not.toMatch(/^\{\{\d+\}\}/);
      expect(['UTILITY', 'MARKETING', 'AUTHENTICATION']).toContain(starter.category);
    }
  });

  it('does not start or end non-OTP bodies with a variable (Meta rejects {{3}}.)', () => {
    for (const starter of listSamyojStarters()) {
      if (starter.category === 'AUTHENTICATION') continue;
      expect(templateTextHasEdgeParams(starter.body), starter.id).toBe(false);
      expect(templateTextHasEdgeParams(starter.bodyHi), `${starter.id} hi`).toBe(false);
    }
  });

  it('builds a valid Meta create payload for every seed draft', () => {
    for (const starter of listSamyojStarters()) {
      const payload = starterCreatePayload(starter, 'en_US', `samyoj_${starter.id}`);
      expect(() => createTemplateSchema.parse(payload), starter.id).not.toThrow();
      const hi = starterCreatePayload(starter, 'hi_IN', `samyoj_${starter.id}_hi`);
      expect(() => createTemplateSchema.parse(hi), starter.id).not.toThrow();
    }
  });

  it('turns URL buttons into chat buttons when no website is given', () => {
    const modern = listSamyojStarters().find((row) => row.id === 'modern_status');
    expect(modern).toBeTruthy();
    const withoutUrl = starterCreatePayload(modern!, 'en_US', 'modern_status_1');
    expect(withoutUrl.buttons?.every((button) => button.type !== 'URL')).toBe(true);
    expect(
      withoutUrl.buttons?.some((button) => button.type === 'QUICK_REPLY' && button.text === 'View details'),
    ).toBe(true);
    const withUrl = starterCreatePayload(modern!, 'en_US', 'modern_status_1', {
      url: 'https://yourstore.com/status',
    });
    expect(
      withUrl.buttons?.some(
        (button) => button.type === 'URL' && button.url === 'https://yourstore.com/status',
      ),
    ).toBe(true);
  });

  it('rejects footers containing variables', () => {
    const payload = {
      name: 'footer_var_test',
      language: 'en_US',
      category: 'UTILITY' as const,
      body: 'Hello {{1}} welcome to our service.',
      bodyExamples: ['Rahul'],
      footer: 'Reply STOP {{1}}',
    };
    expect(() => createTemplateSchema.parse(payload)).toThrow(/Footer cannot contain variables or placeholders/i);

    const namedPayload = {
      ...payload,
      footer: 'Reply STOP {{name}}',
    };
    expect(() => createTemplateSchema.parse(namedPayload)).toThrow(/Footer cannot contain variables or placeholders/i);
  });
});
