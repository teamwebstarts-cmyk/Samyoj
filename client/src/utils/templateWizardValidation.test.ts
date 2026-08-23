import { describe, expect, it } from 'vitest';
import { validateTemplateWizardStep } from '../components/templates/wizard/templateWizardModel';
import { emptyTemplateForm } from './templateForm';

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
});
