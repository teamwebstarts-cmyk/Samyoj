import { getTemplateParts } from '../inbox/WhatsAppPreview';
import { applySendExtrasToButtons } from '../../utils/templateForm';
import type { MessageTemplate } from '../../types';

export function applyParamsToText(text: string, params: string[]) {
  return params.reduce((result, value, index) => {
    const placeholder = value?.trim() || `{{${index + 1}}}`;
    return result.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), placeholder);
  }, text);
}

export function getFilledTemplatePreview(
  template: MessageTemplate,
  params: {
    bodyParams: string[];
    headerParams: string[];
    headerMediaUrl?: string;
    couponCode?: string;
    buttonUrlSuffixes?: string[];
  }
) {
  const parts = getTemplateParts(template);
  return {
    ...parts,
    header: parts.header ? applyParamsToText(parts.header, params.headerParams) : undefined,
    headerMediaUrl: params.headerMediaUrl || undefined,
    body: parts.body && parts.body !== '—' ? applyParamsToText(parts.body, params.bodyParams) : parts.body,
    buttons: applySendExtrasToButtons(parts.buttons, {
      couponCode: params.couponCode,
      buttonUrlSuffixes: params.buttonUrlSuffixes,
    }),
  };
}

export function getTemplateHeaderFormat(template: MessageTemplate) {
  const header = template.components?.find((c) => c.type?.toUpperCase() === 'HEADER') as
    | { format?: string }
    | undefined;
  return header?.format?.toUpperCase();
}

export function templateNeedsHeaderMedia(template: MessageTemplate) {
  const format = getTemplateHeaderFormat(template);
  return Boolean(format && format !== 'TEXT');
}

export function headerMediaLabel(format?: string) {
  switch (format) {
    case 'IMAGE':
      return 'Header image link';
    case 'VIDEO':
      return 'Header video link';
    case 'DOCUMENT':
      return 'Header document link';
    default:
      return 'Header file link';
  }
}
