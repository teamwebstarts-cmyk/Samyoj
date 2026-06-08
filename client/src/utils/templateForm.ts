import type { MessageTemplate, TemplateButton, TemplateLibraryEntry } from '../types';
import { countTemplateVars } from './templateUtils';

export type TemplateButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';
export type HeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';

export interface TemplateButtonForm {
  type: TemplateButtonType;
  text: string;
  url: string;
  phone_number: string;
  example: string;
}

export interface TemplateFormState {
  name: string;
  language: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  body: string;
  header: string;
  headerFormat: HeaderFormat;
  headerMediaHandle: string;
  footer: string;
  buttons: TemplateButtonForm[];
  bodyExamples: string[];
  headerExamples: string[];
  addSecurityRecommendation: boolean;
  authType: 'OTP' | 'ONE_TAP';
}

export const emptyTemplateForm: TemplateFormState = {
  name: '',
  language: 'en_US',
  category: 'UTILITY',
  body: '',
  header: '',
  headerFormat: 'TEXT',
  headerMediaHandle: '',
  footer: '',
  buttons: [],
  bodyExamples: [],
  headerExamples: [],
  addSecurityRecommendation: true,
  authType: 'OTP',
};

export function emptyTemplateButton(type: TemplateButtonType = 'QUICK_REPLY'): TemplateButtonForm {
  return { type, text: '', url: '', phone_number: '', example: '' };
}

export function buttonsFromTemplate(template: MessageTemplate | TemplateLibraryEntry): TemplateButtonForm[] {
  const raw = template.buttons ?? template.components?.find((c) => c.type === 'BUTTONS')?.buttons;
  if (!raw?.length) return [];

  return raw
    .filter((b) => ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE'].includes(b.type))
    .map((b) => ({
      type: b.type as TemplateButtonType,
      text: b.text || '',
      url: b.url || '',
      phone_number: b.phone_number || '',
      example: '',
    }));
}

function syncExamples(text: string, current: string[]): string[] {
  const count = countTemplateVars(text);
  return Array.from({ length: count }, (_, i) => current[i] || '');
}

export function formFromLibraryEntry(entry: TemplateLibraryEntry): TemplateFormState {
  const body = entry.body || '';
  const header = entry.header || '';
  return {
    name: '',
    language: entry.language || 'en_US',
    category:
      entry.category === 'MARKETING' || entry.category === 'AUTHENTICATION'
        ? entry.category
        : 'UTILITY',
    body,
    header,
    headerFormat: header ? 'TEXT' : 'NONE',
    headerMediaHandle: '',
    footer: entry.footer || '',
    buttons: buttonsFromTemplate(entry),
    bodyExamples: syncExamples(body, []),
    headerExamples: syncExamples(header, []),
    addSecurityRecommendation: true,
    authType: 'OTP',
  };
}

export function formFromMessageTemplate(template: MessageTemplate): TemplateFormState {
  const components = template.components ?? [];
  const body = components.find((c) => c.type === 'BODY')?.text || '';
  const header = components.find((c) => c.type === 'HEADER')?.text || '';
  const headerComp = components.find((c) => c.type === 'HEADER') as { format?: string } | undefined;
  const format = (headerComp?.format?.toUpperCase() || (header ? 'TEXT' : 'NONE')) as HeaderFormat;

  return {
    name: template.name,
    language: template.language || 'en_US',
    category: (template.category as TemplateFormState['category']) || 'UTILITY',
    body,
    header,
    headerFormat: format === 'TEXT' && !header ? 'NONE' : format,
    headerMediaHandle: '',
    footer: components.find((c) => c.type === 'FOOTER')?.text || '',
    buttons: buttonsFromTemplate(template),
    bodyExamples: syncExamples(body, []),
    headerExamples: syncExamples(header, []),
    addSecurityRecommendation: true,
    authType: 'OTP',
  };
}

export function duplicateTemplateForm(template: MessageTemplate): TemplateFormState {
  const base = formFromMessageTemplate(template);
  return {
    ...base,
    name: `${template.name}_copy`,
  };
}

export function buildCreatePayload(form: TemplateFormState) {
  return {
    name: form.name,
    language: form.language,
    category: form.category,
    body: form.body,
    header: form.headerFormat === 'TEXT' ? form.header || undefined : undefined,
    headerFormat: form.headerFormat,
    headerMediaHandle: ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(form.headerFormat)
      ? form.headerMediaHandle || undefined
      : undefined,
    footer: form.footer || undefined,
    bodyExamples: form.bodyExamples.filter(Boolean).length ? form.bodyExamples : undefined,
    headerExamples: form.headerExamples.filter(Boolean).length ? form.headerExamples : undefined,
    addSecurityRecommendation:
      form.category === 'AUTHENTICATION' ? form.addSecurityRecommendation : undefined,
    authType: form.category === 'AUTHENTICATION' ? form.authType : undefined,
    buttons: form.buttons.length
      ? form.buttons.map((b) => ({
          type: b.type,
          text: b.text,
          ...(b.type === 'URL' ? { url: b.url } : {}),
          ...(b.type === 'PHONE_NUMBER' ? { phone_number: b.phone_number } : {}),
          ...(b.type === 'COPY_CODE' ? { example: b.example } : {}),
        }))
      : undefined,
  };
}

export function getTemplateButtons(
  template: MessageTemplate | TemplateLibraryEntry
): TemplateButton[] {
  if (template.buttons?.length) return template.buttons;
  return template.components?.find((c) => c.type === 'BUTTONS')?.buttons || [];
}

export function syncFormExamples(form: TemplateFormState): TemplateFormState {
  return {
    ...form,
    bodyExamples: syncExamples(form.body, form.bodyExamples),
    headerExamples: syncExamples(form.header, form.headerExamples),
  };
}
