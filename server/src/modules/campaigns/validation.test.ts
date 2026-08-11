import { describe, expect, it } from 'vitest';
import { dedupeRecipients, hasAuditableCampaignConsent } from './recipients';
import { buildTemplateComponents, mergeTemplateParams } from './template-params';
import { createCampaignSchema } from './types';
import { isAbsoluteInstant } from './safety';
import { templateValidationErrors } from './template-validation';

describe('dedupeRecipients', () => {
  it('removes duplicate phone numbers keeping first occurrence', () => {
    const result = dedupeRecipients([
      { phone: '919876543210', name: 'A' },
      { phone: '919876543210', name: 'B' },
      { phone: '14155552671' },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('A');
  });
});

describe('campaign consent', () => {
  it('rejects unknown, revoked, and provenance-free contacts', () => {
    expect(hasAuditableCampaignConsent({ optedIn: false, consentSource: 'IMPORT', consentAt: new Date() })).toBe(false);
    expect(hasAuditableCampaignConsent({ optedIn: true, consentSource: null, consentAt: new Date() })).toBe(false);
    expect(hasAuditableCampaignConsent({ optedIn: true, consentSource: 'EXPLICIT', consentAt: null })).toBe(false);
  });

  it('accepts only opted-in contacts with recorded consent', () => {
    expect(hasAuditableCampaignConsent({ optedIn: true, consentSource: 'EXPLICIT', consentAt: new Date() })).toBe(true);
    expect(
      hasAuditableCampaignConsent({
        optedIn: true,
        consentSource: 'EXPLICIT',
        consentAt: new Date(),
        optOutAt: new Date(),
      })
    ).toBe(false);
  });

  it('rejects non-UTC scheduledAt values at the route payload schema boundary', () => {
    const base = { name: 'Launch', templateName: 'approved_template' };
    expect(() => createCampaignSchema.parse({ ...base, scheduledAt: '2026-08-09T12:00:00+05:30' })).toThrow();
    expect(() => createCampaignSchema.parse({ ...base, scheduledAt: '2026-08-09T12:00:00' })).toThrow();
    expect(isAbsoluteInstant('2026-02-31T12:00:00.000Z')).toBe(false);
    expect(() => createCampaignSchema.parse({ ...base, scheduledAt: '2026-08-09T12:00:00.000Z' })).not.toThrow();
  });
});

describe('mergeTemplateParams', () => {
  it('replaces {{name}} placeholder with recipient name', () => {
    const merged = mergeTemplateParams({ body: ['Hello {{name}}'] }, null, 'Alice');
    expect(merged.body).toEqual(['Hello Alice']);
  });

  it('prefers recipient variables over campaign defaults', () => {
    const merged = mergeTemplateParams(
      { body: ['Default'] },
      { body: ['Custom'] },
      'Bob'
    );
    expect(merged.body).toEqual(['Custom']);
  });
});

describe('buildTemplateComponents', () => {
  it('builds body parameters for template send', () => {
    const components = buildTemplateComponents({ body: ['Hi', 'Order #1'] });
    expect(components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Hi' },
          { type: 'text', text: 'Order #1' },
        ],
      },
    ]);
  });
});

describe('approved template validation', () => {
  const template = {
    id: 't1',
    name: 'sale_offer',
    status: 'APPROVED',
    category: 'MARKETING',
    language: 'en_US',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Offer' },
      { type: 'BODY', text: 'Hi {{1}}, save {{2}}' },
    ],
  };

  it('rejects name, language, category, and variable-shape mismatches', () => {
    const errors = templateValidationErrors(template, {
      name: 'other_template',
      language: 'hi',
      category: 'UTILITY',
      params: { body: ['Alice'] },
    });
    expect(errors.join(' ')).toContain('name');
    expect(errors.join(' ')).toContain('language');
    expect(errors.join(' ')).toContain('category');
    expect(errors.join(' ')).toContain('requires 2 variable(s)');
  });

  it('accepts the exact approved template shape', () => {
    expect(templateValidationErrors(template, {
      name: 'sale_offer',
      language: 'en_US',
      category: 'MARKETING',
      params: { body: ['Alice', '20%'] },
    })).toEqual([]);
  });

  it('counts repeated placeholders once', () => {
    const repeated = { ...template, components: [{ type: 'BODY', text: 'Hi {{1}}, {{1}}' }] };
    expect(templateValidationErrors(repeated, {
      name: 'sale_offer',
      language: 'en_US',
      params: { body: ['Alice'] },
    })).toEqual([]);
  });

  it('rejects non-contiguous placeholders without inflating unique count', () => {
    const nonContiguous = { ...template, components: [{ type: 'BODY', text: 'Hi {{1}}, {{3}}' }] };
    const errors = templateValidationErrors(nonContiguous, {
      name: 'sale_offer',
      language: 'en_US',
      params: { body: ['Alice', 'Order'] },
    });
    expect(errors.join(' ')).toContain('non-contiguous');
    expect(errors.join(' ')).not.toContain('requires 3 variable(s)');
  });
});
