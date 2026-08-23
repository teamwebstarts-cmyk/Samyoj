import { describe, expect, it } from 'vitest';
import {
  autoFillTemplateSamples,
  validateTemplateWizardStep,
} from '../components/templates/wizard/templateWizardModel';
import { emptyTemplateForm, sampleForVariable } from './templateForm';

describe('validateTemplateWizardStep', () => {
  it('does not block step 0 on marketing footer STOP warning', () => {
    const form = {
      ...emptyTemplateForm,
      name: 'promo_offer',
      body: 'Hi {{1}}, here is your offer.',
      category: 'MARKETING' as const,
      footer: '',
      bodyExamples: ['Rahul'],
    };
    const issues = validateTemplateWizardStep(0, form);
    expect(issues.some((issue) => issue.field === 'footer')).toBe(false);
  });

  it('still blocks step 0 when media header sample is missing', () => {
    const form = {
      ...emptyTemplateForm,
      name: 'banner_update',
      body: 'Your order is ready.',
      headerFormat: 'IMAGE' as const,
      headerMediaHandle: '',
    };
    const issues = validateTemplateWizardStep(0, form);
    expect(issues.some((issue) => issue.field === 'headerMediaHandle')).toBe(true);
  });

  it('blocks review submit when body variable samples are missing', () => {
    const form = {
      ...emptyTemplateForm,
      name: 'order_ping',
      body: 'Hi {{1}}, your order is ready.',
      bodyExamples: [''],
    };
    const issues = validateTemplateWizardStep(1, form);
    expect(issues.some((issue) => issue.field === 'bodyExamples')).toBe(true);
  });
});

describe('sampleForVariable', () => {
  it('uses mapped contact sources for preview samples', () => {
    expect(sampleForVariable('Customer name', 1, 'contact.name')).toBe('Rahul');
    expect(sampleForVariable('', 2, 'contact.phone')).toBe('+919876543210');
    expect(sampleForVariable('', 3, 'contact.email')).toBe('rahul@example.com');
  });
});

describe('autoFillTemplateSamples', () => {
  it('fills empty body samples from variable mapping', () => {
    const next = autoFillTemplateSamples({
      ...emptyTemplateForm,
      body: 'Hi {{1}}, see you on {{2}}.',
      bodyExamples: ['', ''],
      variableMeta: [
        { scope: 'body', index: 1, description: 'Customer name', suggestedSource: 'contact.name' },
        { scope: 'body', index: 2, description: 'Date or time', suggestedSource: 'custom' },
      ],
    });
    expect(next.bodyExamples[0]).toBe('Rahul');
    expect(next.bodyExamples[1]).toBe('12 Aug 2026');
  });
});
