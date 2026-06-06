import type { MessageTemplate, TemplateButton, TemplateLibraryEntry } from '../types';

export type TemplateButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

export interface TemplateButtonForm {
  type: TemplateButtonType;
  text: string;
  url: string;
  phone_number: string;
}

export interface TemplateFormState {
  name: string;
  language: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  body: string;
  header: string;
  footer: string;
  buttons: TemplateButtonForm[];
}

export const emptyTemplateForm: TemplateFormState = {
  name: '',
  language: 'en_US',
  category: 'UTILITY',
  body: '',
  header: '',
  footer: '',
  buttons: [],
};

export function emptyTemplateButton(type: TemplateButtonType = 'QUICK_REPLY'): TemplateButtonForm {
  return { type, text: '', url: '', phone_number: '' };
}

export function buttonsFromTemplate(template: MessageTemplate | TemplateLibraryEntry): TemplateButtonForm[] {
  const raw = template.buttons ?? template.components?.find((c) => c.type === 'BUTTONS')?.buttons;
  if (!raw?.length) return [];

  return raw
    .filter((b) => ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'].includes(b.type))
    .map((b) => ({
      type: b.type as TemplateButtonType,
      text: b.text || '',
      url: b.url || '',
      phone_number: b.phone_number || '',
    }));
}

export function formFromLibraryEntry(entry: TemplateLibraryEntry): TemplateFormState {
  return {
    name: '',
    language: entry.language || 'en_US',
    category:
      entry.category === 'MARKETING' || entry.category === 'AUTHENTICATION'
        ? entry.category
        : 'UTILITY',
    body: entry.body || '',
    header: entry.header || '',
    footer: entry.footer || '',
    buttons: buttonsFromTemplate(entry),
  };
}

export function formFromMessageTemplate(template: MessageTemplate): TemplateFormState {
  const components = template.components ?? [];
  return {
    name: template.name,
    language: template.language || 'en_US',
    category: (template.category as TemplateFormState['category']) || 'UTILITY',
    body: components.find((c) => c.type === 'BODY')?.text || '',
    header: components.find((c) => c.type === 'HEADER')?.text || '',
    footer: components.find((c) => c.type === 'FOOTER')?.text || '',
    buttons: buttonsFromTemplate(template),
  };
}

export function buildCreatePayload(form: TemplateFormState) {
  return {
    name: form.name,
    language: form.language,
    category: form.category,
    body: form.body,
    header: form.header || undefined,
    footer: form.footer || undefined,
    buttons: form.buttons.length
      ? form.buttons.map((b) => ({
          type: b.type,
          text: b.text,
          ...(b.type === 'URL' ? { url: b.url } : {}),
          ...(b.type === 'PHONE_NUMBER' ? { phone_number: b.phone_number } : {}),
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
