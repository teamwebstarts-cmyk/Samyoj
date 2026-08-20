import type { MessageTemplate } from '../whatsapp/meta.service';
import type { TemplateParams } from './types';
import { buildTemplateComponents, mergeTemplateParams } from './template-params';

export type TemplateValidationInput = {
  name: string;
  language: string;
  category?: string;
  params?: TemplateParams | null;
};

export function templatePlaceholderProfile(text?: string) {
  const tokens = placeholderTokens(text);
  const numeric = [...new Set(tokens.filter((token) => /^\d+$/.test(token)))].map(Number)
    .sort((a, b) => a - b);
  const named = [...new Set(tokens.filter((token) => !/^\d+$/.test(token)))];
  return {
    tokens,
    numeric,
    named,
    mixed: numeric.length > 0 && named.length > 0,
  };
}

function placeholderTokens(text?: string) {
  return Array.from(text?.matchAll(/\{\{([^}]+)\}\}/g) ?? [], (match) => match[1].trim());
}

export function templateValidationErrors(
  template: MessageTemplate,
  input: TemplateValidationInput
): string[] {
  const errors: string[] = [];
  if (template.name !== input.name) errors.push(`name "${input.name}" does not match approved template "${template.name}"`);
  if (template.status.toUpperCase() !== 'APPROVED') errors.push(`status is ${template.status}, not APPROVED`);
  if (input.language !== template.language) errors.push(`language "${input.language}" is not approved; use "${template.language}"`);
  if (input.category && template.category.toUpperCase() !== input.category.toUpperCase()) {
    errors.push(`category "${template.category}" does not match required category "${input.category}"`);
  }
  if (template.rejected_reason) errors.push(`Meta rejection reason: ${template.rejected_reason}`);

  const approved = (template.components || []).map((component) => component.type.toUpperCase());
  const supplied = buildTemplateComponents(input.params, template) as Array<Record<string, unknown>>;
  const suppliedTypes = supplied.map((component) => String(component.type).toUpperCase());
  for (const type of ['HEADER', 'BODY']) {
    const expected = approved.filter((item) => item === type).length;
    const actual = suppliedTypes.filter((item) => item === type).length;
    const component = template.components?.find((item) => item.type.toUpperCase() === type);
    const profile = templatePlaceholderProfile(component?.text);
    const { indexes, tokens } = { indexes: profile.numeric, tokens: profile.tokens };
    const unknown = profile.named.filter((token) => token !== 'name');
    if (unknown.length) {
      errors.push(`${type.toLowerCase()} contains unsupported placeholders: ${unknown.join(', ')}`);
    }
    if (profile.mixed) {
      errors.push(`${type.toLowerCase()} mixes numeric and named placeholders; use one placeholder style`);
    }
    const variables = profile.numeric.length + profile.named.length;
    const values = type === 'BODY' ? input.params?.body || [] : input.params?.header || [];
    // Meta auto-fills the built-in {{name}} variable, so named-only placeholders
    // need no matching `parameters` entry. Only enforce component-shape and
    // count when the template actually uses numeric {{n}} placeholders.
    const requiresParamComponent = profile.numeric.length > 0;
    if (requiresParamComponent) {
      if (expected !== actual && (variables > 0 || values.length > 0)) {
        errors.push(`${type.toLowerCase()} component does not match approved template shape`);
      }
      if (values.length !== variables) {
        errors.push(`${type.toLowerCase()} requires ${variables} variable(s), received ${values.length}`);
      }
    }
    if (values.some((value) => /\{\{[^}]+\}\}/.test(value))) {
      errors.push(`${type.toLowerCase()} contains unresolved placeholders; provide recipient data before sending`);
    }
    if (indexes.some((index, position) => index !== position + 1)) {
      errors.push(`${type.toLowerCase()} uses non-contiguous numeric placeholders ${indexes.join(', ')}; use contiguous indexes starting at 1`);
    }
  }

  const header = template.components?.find((item) => item.type.toUpperCase() === 'HEADER');
  if (header?.format && header.format.toUpperCase() !== 'TEXT' && input.params?.header?.length) {
    errors.push(`header requires ${header.format.toLowerCase()} media, not text variables`);
  }
  if (header?.format && header.format.toUpperCase() !== 'TEXT' && !input.params?.headerMediaUrl) {
    errors.push(`header requires an approved ${header.format.toLowerCase()} media URL`);
  }
  const buttons = template.components?.find((component) => component.type.toUpperCase() === 'BUTTONS')?.buttons || [];
  const hasCopyCode = buttons.some((button) => (button.type || '').toUpperCase() === 'COPY_CODE');
  if (input.params?.couponCode && !hasCopyCode) {
    errors.push('couponCode was supplied but the approved template has no COPY_CODE button');
  }
  if (hasCopyCode && !input.params?.couponCode?.trim()) {
    errors.push('copy-code button requires a couponCode');
  }
  const dynamicUrlCount = buttons.filter(
    (button) => (button.type || '').toUpperCase() === 'URL' && /\{\{/.test(button.url || '')
  ).length;
  if (dynamicUrlCount > 0) {
    const suffixes = input.params?.buttonUrlSuffixes || [];
    if (dynamicUrlCount > suffixes.filter((value) => value?.trim()).length) {
      errors.push(`dynamic URL button(s) require ${dynamicUrlCount} link suffix(es)`);
    }
  }
  return errors;
}

export function assertApprovedCampaignTemplate(
  template: MessageTemplate | null | undefined,
  input: TemplateValidationInput
) {
  if (!template) throw new Error(`Template "${input.name}" was not found on the connected WhatsApp account`);
  const errors = templateValidationErrors(template, input);
  if (errors.length) throw new Error(`Approved template mismatch: ${errors.join('; ')}`);
  return template;
}

/** Name / language / APPROVED only. Do not pass unmerged params or a forced MARKETING category. */
export function assertApprovedTemplateIdentity(
  template: MessageTemplate | null | undefined,
  input: Pick<TemplateValidationInput, 'name' | 'language'>
) {
  if (!template) throw new Error(`Template "${input.name}" was not found on the connected WhatsApp account`);
  const errors: string[] = [];
  if (template.name !== input.name) {
    errors.push(`name "${input.name}" does not match approved template "${template.name}"`);
  }
  if (template.status.toUpperCase() !== 'APPROVED') {
    errors.push(`status is ${template.status}, not APPROVED`);
  }
  if (input.language !== template.language) {
    errors.push(`language "${input.language}" is not approved; use "${template.language}"`);
  }
  if (errors.length) throw new Error(`Approved template mismatch: ${errors.join('; ')}`);
  return template;
}

export function buildValidatedTemplateComponents(
  template: MessageTemplate,
  campaignParams: TemplateParams | null | undefined,
  recipientVariables: { body?: string[]; header?: string[]; attributes?: Record<string, string> } | null | undefined,
  recipientName?: string | null
) {
  const params = mergeTemplateParams(campaignParams, recipientVariables, recipientName);
  const errors = templateValidationErrors(template, {
    name: template.name,
    language: template.language,
    category: template.category,
    params,
  });
  if (errors.length) throw new Error(`Approved template mismatch: ${errors.join('; ')}`);
  return buildTemplateComponents(params, template);
}

export function assertCampaignRecipientTemplates(
  template: MessageTemplate,
  campaignParams: TemplateParams | null | undefined,
  recipients: Array<{
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    customAttributes?: Record<string, string> | unknown | null;
    variables?: { body?: string[]; header?: string[]; attributes?: Record<string, string> } | null;
  }>,
  options: { name?: string; language?: string; category?: string } = {}
) {
  for (const recipient of recipients) {
    const params = mergeTemplateParams(
      campaignParams,
      recipient.variables,
      recipient.name,
      template,
      {
        name: recipient.name,
        phone: recipient.phone,
        email: recipient.email,
        customAttributes: recipient.customAttributes,
      }
    );
    const errors = templateValidationErrors(template, {
      name: options.name ?? template.name,
      language: options.language ?? template.language,
      category: options.category,
      params,
    });
    if (errors.length) {
      throw new Error(
        `Recipient ${recipient.name || 'without a name'} has invalid template data: ${errors.join('; ')}`
      );
    }
  }
}
