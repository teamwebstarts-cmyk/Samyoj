import type { MessageTemplate } from '../whatsapp/meta.service';
import type { TemplateParams } from './types';
import { buildTemplateComponents, mergeTemplateParams } from './template-params';

export type TemplateValidationInput = {
  name: string;
  language: string;
  category?: string;
  params?: TemplateParams | null;
};

function placeholderIndexes(text?: string) {
  const indexes = Array.from(text?.matchAll(/\{\{(\d+)\}\}/g) ?? [], (match) => Number(match[1]));
  return [...new Set(indexes)].sort((a, b) => a - b);
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
    const indexes = placeholderIndexes(component?.text);
    const variables = indexes.length;
    const values = type === 'BODY' ? input.params?.body || [] : input.params?.header || [];
    if (expected !== actual && (variables > 0 || values.length > 0)) {
      errors.push(`${type.toLowerCase()} component does not match approved template shape`);
    }
    if (values.length !== variables) {
      errors.push(`${type.toLowerCase()} requires ${variables} variable(s), received ${values.length}`);
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
  const hasCopyCode = template.components?.some((component) =>
    component.type.toUpperCase() === 'BUTTONS' &&
    component.buttons?.some((button) => button.type.toUpperCase() === 'COPY_CODE')
  );
  if (input.params?.couponCode && !hasCopyCode) {
    errors.push('couponCode was supplied but the approved template has no COPY_CODE button');
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

export function buildValidatedTemplateComponents(
  template: MessageTemplate,
  campaignParams: TemplateParams | null | undefined,
  recipientVariables: { body?: string[]; header?: string[] } | null | undefined,
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
