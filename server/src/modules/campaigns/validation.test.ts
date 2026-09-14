import { describe, expect, it } from 'vitest';
import { dedupeRecipients, hasAuditableCampaignConsent } from './recipients';
import { buildTemplateComponents, mergeTemplateParams } from './template-params';
import { billingCategoryForTemplate, createCampaignSchema } from './types';
import { isAbsoluteInstant, parseMetaTimestamp } from './safety';
import { assertApprovedTemplateIdentity, templateValidationErrors } from './template-validation';

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

  it('collapses +91 and 91 variants of the same Indian mobile', () => {
    const result = dedupeRecipients([
      { phone: '+919876543210', name: 'A' },
      { phone: '919876543210', name: 'B' },
      { phone: '9876543210', name: 'C' },
    ]);
    expect(result).toHaveLength(1);
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
    expect(() => createCampaignSchema.parse({ ...base, scheduledAt: null })).not.toThrow();
  });

  it('validates drip campaign follow-up configuration in audienceConfig', () => {
    const base = { name: 'Launch', templateName: 'approved_template' };
    const valid = createCampaignSchema.parse({
      ...base,
      audienceConfig: {
        drip: {
          enabled: true,
          delayHours: 48,
          condition: 'no_reply',
          templateName: 'follow_up_step2',
          templateLanguage: 'en',
        },
      },
    });
    expect(valid.audienceConfig?.drip?.enabled).toBe(true);
    expect(valid.audienceConfig?.drip?.delayHours).toBe(48);
    expect(valid.audienceConfig?.drip?.condition).toBe('no_reply');

    // Rejects invalid delay (must be at least 1 hour and at most 168 hours)
    expect(() =>
      createCampaignSchema.parse({
        ...base,
        audienceConfig: {
          drip: {
            enabled: true,
            delayHours: 0,
            templateName: 'follow_up',
          },
        },
      })
    ).toThrow();
  });

  it('rejects malformed provider timestamps instead of persisting them', () => {
    expect(parseMetaTimestamp('not-a-timestamp')).toBeUndefined();
    expect(parseMetaTimestamp('1700000000.5')).toBeUndefined();
    expect(parseMetaTimestamp('0')).toBeUndefined();
    expect(parseMetaTimestamp('1700000000')).toEqual(new Date('2023-11-14T22:13:20.000Z'));
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

  it('fills a supported named template placeholder from recipient data', () => {
    const merged = mergeTemplateParams(
      undefined,
      undefined,
      'Alice',
      { components: [{ type: 'BODY', text: 'Hello {{name}}' }] } as never
    );
    expect(merged.body).toEqual(['Alice']);
  });

  it('resolves whole-value contact tokens without shifting positions', () => {
    const merged = mergeTemplateParams(
      { body: ['{{name}}', '{{email}}', 'order-9'] },
      null,
      'Rahul',
      undefined,
      { name: 'Rahul', phone: '9198', email: 'rahul@example.com' }
    );
    expect(merged.body).toEqual(['Rahul', 'rahul@example.com', 'order-9']);
  });

  it('keeps positional length when a contact field is empty', () => {
    const merged = mergeTemplateParams(
      { body: ['{{name}}', '{{email}}'] },
      null,
      null,
      undefined,
      { name: '', email: '' }
    );
    expect(merged.body).toHaveLength(2);
    expect(merged.body?.[0]).toBe('Valued customer');
    expect(merged.body?.[1]).toBe('your registered email');
  });

  it('does not drop empty positional slots', () => {
    const merged = mergeTemplateParams({ body: ['', 'order-1'] }, null, 'Rahul');
    expect(merged.body).toEqual(['-', 'order-1']);
  });

  it('replaces in-string {{name}} with the fallback when the contact has no name', () => {
    const merged = mergeTemplateParams(
      { body: ['Hello {{name}}'] },
      null,
      '',
      undefined,
      { name: '' }
    );
    expect(merged.body).toEqual(['Hello Valued customer']);
  });

  it('passes coupon and URL suffixes through merge', () => {
    const merged = mergeTemplateParams(
      { body: ['{{name}}'], couponCode: 'SAVE20', buttonUrlSuffixes: ['order-9'] },
      null,
      'Rahul',
      undefined,
      { name: 'Rahul' }
    );
    expect(merged.body).toEqual(['Rahul']);
    expect(merged.couponCode).toBe('SAVE20');
    expect(merged.buttonUrlSuffixes).toEqual(['order-9']);
  });

  it('resolves custom attribute tokens from the contact', () => {
    const merged = mergeTemplateParams(
      { body: ['{{name}}', '{{order_id}}'] },
      null,
      'Rahul',
      undefined,
      { name: 'Rahul', customAttributes: { order_id: 'ORD-1042' } }
    );
    expect(merged.body).toEqual(['Rahul', 'ORD-1042']);
  });

  it('overlays named CSV attributes onto contact custom fields', () => {
    const merged = mergeTemplateParams(
      { body: ['{{name}}', '{{order_id}}'] },
      { attributes: { order_id: 'ORD-9' } },
      'Rahul',
      undefined,
      { name: 'Rahul' }
    );
    expect(merged.body).toEqual(['Rahul', 'ORD-9']);
  });

  it('keeps positional length when a custom attribute is missing', () => {
    const merged = mergeTemplateParams(
      { body: ['{{order_id}}', 'static'] },
      null,
      'Rahul',
      undefined,
      { name: 'Rahul', customAttributes: {} }
    );
    expect(merged.body).toEqual(['-', 'static']);
  });
});

describe('buildTemplateComponents', () => {
  it('builds body parameters for template send', () => {
    const template = { components: [{ type: 'BODY', text: 'Hi {{1}}, order {{2}}' }] };
    const components = buildTemplateComponents({ body: ['Hi', 'Order #1'] }, template as never);
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

  it('omits params when the template has no numeric placeholder (prevents #132012)', () => {
    const template = { components: [{ type: 'BODY', text: 'Hi there, welcome!' }] };
    const components = buildTemplateComponents({ body: ['stray'] }, template as never);
    expect(components).toEqual([]);
  });

  it('emits copy-code and dynamic URL button components', () => {
    const template = {
      components: [
        { type: 'BODY', text: 'Hi {{1}}' },
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'URL', text: 'Track', url: 'https://example.com/{{1}}' },
            { type: 'COPY_CODE', text: 'Copy code' },
          ],
        },
      ],
    };
    const components = buildTemplateComponents(
      { body: ['Rahul'], couponCode: 'SAVE20', buttonUrlSuffixes: ['order-9'] },
      template as never
    );
    expect(components).toEqual(
      expect.arrayContaining([
        {
          type: 'button',
          sub_type: 'copy_code',
          index: '1',
          parameters: [{ type: 'coupon_code', coupon_code: 'SAVE20' }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: 'order-9' }],
        },
      ])
    );
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

  it('rejects unresolved and unsupported placeholders as actionable errors', () => {
    const unresolved = {
      ...template,
      components: [{ type: 'BODY', text: 'Hi {{unknown}}' }],
    };
    const errors = templateValidationErrors(unresolved, {
      name: 'sale_offer',
      language: 'en_US',
      category: 'MARKETING',
      params: { body: ['{{unknown}}'] },
    });
    expect(errors.join(' ')).toContain('unsupported placeholders');
    expect(errors.join(' ')).toContain('unresolved placeholders');
  });

  it('supports named-only placeholders independently', () => {
    const named = { ...template, components: [{ type: 'BODY', text: 'Hi {{name}}, welcome back {{name}}' }] };
    expect(templateValidationErrors(named, {
      name: 'sale_offer',
      language: 'en_US',
      category: 'MARKETING',
      params: { body: ['Alice'] },
    })).toEqual([]);
  });

  it('rejects mixed numeric and named placeholders deterministically', () => {
    const mixed = { ...template, components: [{ type: 'BODY', text: 'Hi {{1}}, {{name}}' }] };
    const errors = templateValidationErrors(mixed, {
      name: 'sale_offer',
      language: 'en_US',
      category: 'MARKETING',
      params: { body: ['Alice', 'Bob'] },
    });
    expect(errors.join(' ')).toContain('mixes numeric and named');
  });

  it('does not require MARKETING when category is omitted', () => {
    const utility = { ...template, category: 'UTILITY', components: [{ type: 'BODY', text: 'Hi {{1}}' }] };
    expect(templateValidationErrors(utility, {
      name: 'sale_offer',
      language: 'en_US',
      params: { body: ['Rahul'] },
    })).toEqual([]);
  });

  it('accepts a Utility template when category matches Utility', () => {
    const utility = { ...template, category: 'UTILITY', components: [{ type: 'BODY', text: 'Hi {{1}}' }] };
    expect(templateValidationErrors(utility, {
      name: 'sale_offer',
      language: 'en_US',
      category: 'UTILITY',
      params: { body: ['Rahul'] },
    })).toEqual([]);
  });
});

describe('assertApprovedTemplateIdentity', () => {
  const approved = {
    id: 't1',
    name: 'order_update',
    status: 'APPROVED',
    category: 'UTILITY',
    language: 'en_US',
    components: [{ type: 'BODY', text: 'Hi {{1}}' }],
  };

  it('allows Utility templates without inspecting params', () => {
    expect(() =>
      assertApprovedTemplateIdentity(approved, { name: 'order_update', language: 'en_US' })
    ).not.toThrow();
  });

  it('still rejects a language mismatch', () => {
    expect(() =>
      assertApprovedTemplateIdentity(approved, { name: 'order_update', language: 'hi' })
    ).toThrow(/language/);
  });
});

describe('copy-code and dynamic URL validation', () => {
  const couponTemplate = {
    id: 't2',
    name: 'offer_code',
    status: 'APPROVED',
    category: 'MARKETING',
    language: 'en_US',
    components: [
      { type: 'BODY', text: 'Use this code' },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'URL', text: 'Shop', url: 'https://shop.example/{{1}}' },
          { type: 'COPY_CODE', text: 'Copy code' },
        ],
      },
    ],
  };

  it('requires coupon and URL suffix when the approved template has those buttons', () => {
    const errors = templateValidationErrors(couponTemplate, {
      name: 'offer_code',
      language: 'en_US',
      params: { body: [] },
    });
    expect(errors.join(' ')).toContain('couponCode');
    expect(errors.join(' ')).toContain('link suffix');
  });

  it('accepts coupon and URL suffix together', () => {
    expect(
      templateValidationErrors(couponTemplate, {
        name: 'offer_code',
        language: 'en_US',
        params: { couponCode: 'SAVE20', buttonUrlSuffixes: ['summer'] },
      })
    ).toEqual([]);
  });
});

describe('billingCategoryForTemplate', () => {
  it('uses the template category for utility and authentication', () => {
    expect(billingCategoryForTemplate('UTILITY')).toBe('UTILITY');
    expect(billingCategoryForTemplate('AUTHENTICATION')).toBe('AUTHENTICATION');
  });

  it('falls back to marketing for unknown or missing categories', () => {
    expect(billingCategoryForTemplate('MARKETING')).toBe('MARKETING');
    expect(billingCategoryForTemplate(undefined)).toBe('MARKETING');
    expect(billingCategoryForTemplate('service')).toBe('MARKETING');
  });
});
