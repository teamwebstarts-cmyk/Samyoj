import type { MessageTemplate } from '../whatsapp/meta.service';
import type { TemplateParams } from './types';

type RecipientVariables = { body?: string[]; header?: string[] };

function textParameters(values: string[]) {
  return values.map((text) => ({ type: 'text' as const, text }));
}

export function mergeTemplateParams(
  campaignParams: TemplateParams | null | undefined,
  recipientVars: RecipientVariables | null | undefined,
  recipientName?: string | null
): TemplateParams {
  const mapValue = (value: string) => {
    if (value === '{{name}}' && recipientName) return recipientName;
    if (recipientName) return value.replace(/\{\{name\}\}/g, recipientName);
    return value;
  };

  const body = recipientVars?.body?.length
    ? recipientVars.body
    : campaignParams?.body?.map(mapValue);

  const header = recipientVars?.header?.length
    ? recipientVars.header
    : campaignParams?.header?.map(mapValue);

  return {
    body: body?.filter(Boolean),
    header: header?.filter(Boolean),
    headerMediaUrl: campaignParams?.headerMediaUrl,
  };
}

export function buildTemplateComponents(
  params: TemplateParams | null | undefined,
  template?: MessageTemplate | null
): unknown[] {
  if (!params) return [];

  const components: unknown[] = [];
  const headerComponent = template?.components?.find((c) => c.type?.toUpperCase() === 'HEADER');

  if (params.headerMediaUrl && headerComponent?.format && headerComponent.format !== 'TEXT') {
    const mediaType = headerComponent.format.toLowerCase();
    components.push({
      type: 'header',
      parameters: [{ type: mediaType, [mediaType]: { link: params.headerMediaUrl } }],
    });
  } else if (params.header?.length) {
    components.push({
      type: 'header',
      parameters: textParameters(params.header),
    });
  }

  if (params.body?.length) {
    components.push({
      type: 'body',
      parameters: textParameters(params.body),
    });
  }

  return components;
}

export function applyTemplateParamsToPreview(
  template: MessageTemplate | null | undefined,
  params: TemplateParams | null | undefined,
  fallbackName?: string
): string {
  if (!template?.components?.length) {
    return fallbackName ? `Template: ${fallbackName}` : '';
  }

  const lines: string[] = [];
  for (const component of template.components) {
    const type = component.type?.toUpperCase();
    let text = component.text?.trim();
    if (!text) continue;

    if (type === 'BODY' && params?.body?.length) {
      params.body.forEach((value, index) => {
        text = text!.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), value);
      });
    }
    if (type === 'HEADER' && params?.header?.length) {
      params.header.forEach((value, index) => {
        text = text!.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), value);
      });
    }

    if (type === 'HEADER' || type === 'BODY' || type === 'FOOTER') {
      lines.push(text);
    }
  }

  return lines.join('\n\n') || (fallbackName ? `Template: ${fallbackName}` : '');
}
