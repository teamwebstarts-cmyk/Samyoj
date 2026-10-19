import { describe, expect, it } from 'vitest';
import {
  applyPurposePreset,
  buildInboxParamSourceOptions,
  campaignParamSelectValue,
  emptyTemplateForm,
  inboxParamSelectValue,
  TEMPLATE_PURPOSE_PRESETS,
  upsertVariableMetaFromParam,
  valueForCampaignParamSource,
  valueForInboxParamSource,
  inferVariableDescription,
  promoteStagedVariables,
  type TemplateVariableMeta,
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

describe('inbox param mapping', () => {
  it('builds contact-aware dropdown options with live previews', () => {
    const options = buildInboxParamSourceOptions({
      name: 'Anand Kumar',
      phone: '+91 98765 43210',
      email: 'anand@example.com',
      customAttributes: { order_id: 'ORD-42' },
    });
    expect(options[0].label).toContain('Anand Kumar');
    expect(options.find((o) => o.value === 'contact.custom.order_id')?.label).toContain('ORD-42');
    expect(options[options.length - 1]).toMatchObject({ value: 'custom', label: 'Custom value…' });
  });

  it('stores contact tokens when picking mapped fields', () => {
    expect(valueForInboxParamSource('contact.name', 'hello')).toBe('{{name}}');
    expect(inboxParamSelectValue('{{name}}')).toBe('contact.name');
    expect(valueForInboxParamSource('contact.custom.order_id', '')).toBe('{{order_id}}');
    expect(inboxParamSelectValue('{{order_id}}')).toBe('contact.custom.order_id');
  });

  it('keeps typed text when Custom value is selected', () => {
    expect(valueForInboxParamSource('custom', '{{name}}')).toBe('');
    expect(valueForInboxParamSource('custom', '29 Aug')).toBe('29 Aug');
    expect(inboxParamSelectValue('29 Aug')).toBe('custom');
  });
});

describe('inferVariableDescription', () => {
  const shipped =
    'Hi {{1}}, order {{2}} is on the way. Tracking ID: {{3}}. Keep this message for tracking.';

  it('labels order_shipped fields from the nearest clause, not the whole prefix', () => {
    expect(inferVariableDescription(shipped, 1)).toBe('Customer name');
    expect(inferVariableDescription(shipped, 2)).toBe('Order number');
    expect(inferVariableDescription(shipped, 3)).toBe('Tracking ID');
  });
});

describe('promoteStagedVariables', () => {
  const staged = (index: number, description = ''): TemplateVariableMeta => ({
    scope: 'body',
    index,
    description,
    suggestedSource: 'custom',
  });

  it('promotes a staged row once its token appears in the body text', () => {
    const stage = [staged(1), staged(2)];
    const afterOne = promoteStagedVariables('Hi {{1}}', [], stage);
    expect(afterOne.variableMeta.map((m) => m.index)).toEqual([1]);
    expect(afterOne.waiting.map((m) => m.index)).toEqual([2]);
    const afterBoth = promoteStagedVariables('Hi {{1}} and {{2}}', afterOne.variableMeta, afterOne.waiting);
    expect(afterBoth.variableMeta.map((m) => m.index)).toEqual([1, 2]);
    expect(afterBoth.waiting).toEqual([]);
  });

  it('applies the first-variable default only to a blank {{1}}', () => {
    const result = promoteStagedVariables('{{1}}', [], [staged(1)], {
      description: 'Customer name',
      suggestedSource: 'contact.name',
    });
    expect(result.variableMeta[0]).toMatchObject({
      description: 'Customer name',
      suggestedSource: 'contact.name',
    });
    const named = promoteStagedVariables('{{1}}', [], [staged(1, 'Amount')], {
      description: 'Customer name',
      suggestedSource: 'contact.name',
    });
    expect(named.variableMeta[0].description).toBe('Amount');
  });

  it('keeps rows untouched while their tokens are still missing', () => {
    const result = promoteStagedVariables('No tokens yet', [], [staged(3)]);
    expect(result.variableMeta).toEqual([]);
    expect(result.waiting).toHaveLength(1);
  });
});
