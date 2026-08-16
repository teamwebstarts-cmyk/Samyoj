import { describe, expect, it } from 'vitest';
import {
  applyPurposePreset,
  campaignParamSelectValue,
  emptyTemplateForm,
  TEMPLATE_PURPOSE_PRESETS,
  upsertVariableMetaFromParam,
  valueForCampaignParamSource,
} from './templateForm';

describe('applyPurposePreset', () => {
  const order = TEMPLATE_PURPOSE_PRESETS.find((p) => p.id === 'order_update')!;
  const offer = TEMPLATE_PURPOSE_PRESETS.find((p) => p.id === 'offer_code')!;

  it('fills name, samples, and mappings for a utility starter', () => {
    const next = applyPurposePreset({ ...emptyTemplateForm }, order);
    expect(next.name).toBe('order_update');
    expect(next.category).toBe('UTILITY');
    expect(next.body).toContain('{{2}}');
    expect(next.bodyExamples).toEqual(['Rahul', 'ORD12345']);
    expect(next.variableMeta[1]).toMatchObject({
      index: 2,
      suggestedSource: 'contact.custom',
      customKey: 'order_id',
    });
  });

  it('clears leftover marketing footer and header when switching to utility', () => {
    const dirty = {
      ...emptyTemplateForm,
      name: 'offer_code',
      category: 'MARKETING' as const,
      header: 'Sale',
      headerFormat: 'TEXT' as const,
      footer: 'Reply STOP to unsubscribe',
      buttons: [
        { type: 'URL' as const, text: 'Shop', url: 'https://example.com', phone_number: '', example: '' },
      ],
    };
    const next = applyPurposePreset(dirty, order);
    expect(next.header).toBe('');
    expect(next.headerFormat).toBe('NONE');
    expect(next.footer).toBe('');
    expect(next.buttons).toEqual([]);
    expect(next.category).toBe('UTILITY');
  });

  it('keeps a custom name and adds copy-code on the offer starter', () => {
    const next = applyPurposePreset({ ...emptyTemplateForm, name: 'diwali_sale' }, offer);
    expect(next.name).toBe('diwali_sale');
    expect(next.category).toBe('MARKETING');
    expect(next.footer.toLowerCase()).toContain('stop');
    expect(next.buttons[0]).toMatchObject({ type: 'COPY_CODE', example: 'SAVE20' });
    expect(next.bodyExamples[1]).toBe('SAVE20');
  });
});

describe('campaign param mapping', () => {
  it('stores {{name}} for each person’s name instead of typed text', () => {
    expect(valueForCampaignParamSource('contact.name', 'anand')).toBe('{{name}}');
    expect(campaignParamSelectValue('{{name}}')).toBe('contact.name');
    expect(valueForCampaignParamSource('contact.phone', '')).toBe('{{phone}}');
    expect(valueForCampaignParamSource('contact.email', '')).toBe('{{email}}');
  });

  it('clears a contact token when switching to the same text for everyone', () => {
    expect(valueForCampaignParamSource('custom', '{{name}}')).toBe('');
    expect(valueForCampaignParamSource('custom', '29 Aug')).toBe('29 Aug');
  });

  it('does not invent {{contact.name}} as a stored token', () => {
    expect(valueForCampaignParamSource('contact.name', '')).not.toContain('contact.name');
    const next = upsertVariableMetaFromParam([], 'body', 0, '{{name}}', 'Customer name');
    expect(next[0]).toMatchObject({
      scope: 'body',
      index: 1,
      suggestedSource: 'contact.name',
    });
  });
});
