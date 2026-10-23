import { describe, expect, it } from 'vitest';
import { applyTemplateParamsToPreview, buildTemplateComponents, mergeTemplateParams } from './template-params';
import type { MessageTemplate } from '../whatsapp/meta.service';

function templateWith(bodyText?: string, headerText?: string): MessageTemplate {
  return {
    id: 't1',
    name: 'demo',
    status: 'APPROVED',
    category: 'UTILITY',
    language: 'en_US',
    components: [
      ...(headerText ? [{ type: 'HEADER', text: headerText }] : []),
      ...(bodyText ? [{ type: 'BODY', text: bodyText }] : []),
    ],
  };
}

describe('buildTemplateComponents', () => {
  it('omits a body component when the template has no placeholder (prevents #132012)', () => {
    const result = buildTemplateComponents({ body: ['Rahul', 'Mumbai'] }, templateWith('Hello!'));
    expect(result).toEqual([]);
  });

  it('attaches only as many params as the template has placeholders', () => {
    const result = buildTemplateComponents(
      { body: ['Rahul', 'Mumbai', 'Extra'] },
      templateWith('Hello {{1}}, you are from {{2}}')
    ) as Array<{ type: string; parameters: Array<{ text: string }> }>;
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('body');
    expect(result[0].parameters.map((p) => p.text)).toEqual(['Rahul', 'Mumbai']);
  });

  it('attaches a header when the header has a placeholder', () => {
    const result = buildTemplateComponents(
      { header: ['Invoice 42'], body: ['Rahul'] },
      templateWith('Hi {{1}}', 'Statement {{1}}')
    ) as Array<{ type: string }>;
    expect(result.map((c) => c.type).sort()).toEqual(['body', 'header']);
  });

  it('does not attach a header component to a non-text media header via text params', () => {
    const mediaTemplate: MessageTemplate = {
      ...templateWith('Hello {{1}}'),
      components: [
        { type: 'HEADER', format: 'IMAGE' },
        { type: 'BODY', text: 'Hello {{1}}' },
      ],
    };
    const result = buildTemplateComponents(
      { header: ['ignored'], body: ['Rahul'] },
      mediaTemplate
    ) as Array<{ type: string }>;
    expect(result.map((c) => c.type)).toEqual(['body']);
  });

  it('returns [] for null params', () => {
    expect(buildTemplateComponents(null, templateWith('Hello {{1}}'))).toEqual([]);
  });

  it('serializes copy_code button with stringified index and coupon_code parameter', () => {
    const template: MessageTemplate = {
      ...templateWith('Use code below'),
      components: [
        { type: 'BODY', text: 'Use code below' },
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'QUICK_REPLY', text: 'Stop' },
            { type: 'COPY_CODE', text: 'Copy Code' },
          ],
        },
      ],
    };

    const result = buildTemplateComponents(
      { couponCode: 'SAVE50' },
      template
    ) as Array<{ type: string; sub_type: string; index: string; parameters: Array<{ type: string; coupon_code: string }> }>;

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'button',
      sub_type: 'copy_code',
      index: '1',
      parameters: [{ type: 'coupon_code', coupon_code: 'SAVE50' }],
    });
  });

  it('serializes OTP button as copy_code with stringified index', () => {
    const template: MessageTemplate = {
      ...templateWith('Your verification code'),
      components: [
        { type: 'BODY', text: 'Your verification code' },
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'OTP', text: 'Copy Code' },
          ],
        },
      ],
    };

    const result = buildTemplateComponents(
      { couponCode: '123456' },
      template
    ) as Array<{ type: string; sub_type: string; index: string; parameters: Array<{ type: string; coupon_code: string }> }>;

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'button',
      sub_type: 'copy_code',
      index: '0',
      parameters: [{ type: 'coupon_code', coupon_code: '123456' }],
    });
  });
});

describe('applyTemplateParamsToPreview', () => {
  it('stores the recipient name when the inbox passes the contact', () => {
    const text = applyTemplateParamsToPreview(
      templateWith('Dear {{1}},\n\nWarm regards,'),
      { body: ['{{name}}'] },
      'deepawali',
      { name: 'Surendra' }
    );
    expect(text).toContain('Dear Surendra');
    expect(text).not.toContain('Rahul');
    expect(text).toContain('Warm regards');
  });
});

describe('mergeTemplateParams', () => {
  it('fills numeric body/header from the contact name only for {{name}} templates', () => {
    const named = mergeTemplateParams(
      null,
      null,
      'Rahul',
      templateWith('Hello {{name}}', 'For {{name}}'),
      { name: 'Rahul' }
    );
    expect(named.body?.[0]).toBe('Rahul');
    expect(named.header?.[0]).toBe('Rahul');

    // Numeric {{1}} templates do NOT auto-fill from the contact name — the
    // caller must supply the positional values.
    const numeric = mergeTemplateParams(
      null,
      null,
      'Rahul',
      templateWith('Hello {{1}}'),
      { name: 'Rahul' }
    );
    expect(numeric.body).toBeUndefined();
  });
});
