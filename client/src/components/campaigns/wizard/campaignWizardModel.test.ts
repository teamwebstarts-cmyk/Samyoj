import { describe, expect, it } from 'vitest';
import {
  buildCampaignPayload,
  countTemplateVariables,
  createEmptyCampaignWizardForm,
  validateCampaignWizardStage,
} from './campaignWizardModel';
import type { MessageTemplate } from '../../../types';

const template: MessageTemplate = {
  id: 'template-1',
  name: 'summer_offer',
  status: 'APPROVED',
  category: 'MARKETING',
  language: 'en',
  body: 'Hi {{1}}, enjoy {{2}}',
  components: [{ type: 'BODY', text: 'Hi {{1}}, enjoy {{2}}' }],
};

describe('campaignWizardModel', () => {
  it('creates a clean form and counts template variables', () => {
    const form = createEmptyCampaignWizardForm();
    expect(form.audienceType).toBe('MANUAL');
    expect(form.timezone).toBeTruthy();
    expect(countTemplateVariables('Hi {{1}} and {{2}}')).toBe(2);
  });

  it('builds an opted-in tags payload', () => {
    const form = {
      ...createEmptyCampaignWizardForm(),
      name: 'Summer offer',
      templateName: template.name,
      templateLanguage: template.language,
      audienceType: 'TAGS' as const,
      audienceTags: 'vip, newsletter',
    };

    expect(buildCampaignPayload(form).audienceConfig).toEqual({
      tags: ['vip', 'newsletter'],
      requireOptIn: true,
    });
  });

  it('validates required message details before continuing', () => {
    const form = {
      ...createEmptyCampaignWizardForm(),
      templateName: template.name,
      bodyParams: [''],
    };

    expect(validateCampaignWizardStage(0, form, template)).toBe('Add a campaign name.');

    const complete = { ...form, name: 'Summer offer', bodyParams: ['Asha', '20% off'] };
    expect(validateCampaignWizardStage(0, complete, template)).toBeNull();
  });

  it('includes media URLs in the template payload', () => {
    const form = {
      ...createEmptyCampaignWizardForm(),
      name: 'Media offer',
      templateName: template.name,
      audienceType: 'MANUAL' as const,
      phones: '919123456789',
      headerMediaUrl: 'https://example.com/image.jpg',
    };

    expect(buildCampaignPayload(form).templateParams).toMatchObject({
      headerMediaUrl: 'https://example.com/image.jpg',
    });
  });
});
