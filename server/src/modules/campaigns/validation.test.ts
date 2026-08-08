import { describe, expect, it } from 'vitest';
import { dedupeRecipients, hasAuditableCampaignConsent } from './recipients';
import { buildTemplateComponents, mergeTemplateParams } from './template-params';

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
