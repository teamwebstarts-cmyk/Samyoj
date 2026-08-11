import type { MessageTemplate } from '../whatsapp/meta.service';
import type { TemplateParams } from './types';

type RecipientVariables = { body?: string[]; header?: string[] };

function textParameters(values: string[]) {
  return values.map((text) => ({ type: 'text' as const, text }));
}

export function mergeTemplateParams(
  campaignParams: TemplateParams | null | undefined,
  recipientVars: RecipientVariables | null | undefined,
  recipientName?: string | null,
  template?: MessageTemplate | null
): TemplateParams {
  const mapValue = (value: string) => {
    if (value === '{{name}}' && recipientName) return recipientName;
    if (recipientName) return value.replace(/\{\{name\}\}/g, recipientName);
    return value;
  };

  const templateBodyHasName = template?.components?.some(
    (component) => component.type?.toUpperCase() === 'BODY' && component.text?.includes('{{name}}')
  );
  const templateHeaderHasName = template?.components?.some(
    (component) => component.type?.toUpperCase() === 'HEADER' && component.text?.includes('{{name}}')
  );
  const body = recipientVars?.body?.length
    ? recipientVars.body.map(mapValue)
    : campaignParams?.body?.map(mapValue) ||
      (templateBodyHasName && recipientName ? [recipientName] : undefined);

  const header = recipientVars?.header?.length
    ? recipientVars.header.map(mapValue)
    : campaignParams?.header?.map(mapValue) ||
      (templateHeaderHasName && recipientName ? [recipientName] : undefined);

  return {
    body: body?.filter(Boolean),
    header: header?.filter(Boolean),
    headerMediaUrl: campaignParams?.headerMediaUrl,
    couponCode: campaignParams?.couponCode,
  };
}

function findCopyCodeButtonIndex(template?: MessageTemplate | null): number | null {
  const buttonsComponent = template?.components?.find((c) => c.type?.toUpperCase() === 'BUTTONS');
  const buttons = buttonsComponent?.buttons;
  if (!buttons?.length) return null;

  const index = buttons.findIndex((btn) => btn.type?.toUpperCase() === 'COPY_CODE');
  return index >= 0 ? index : null;
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

  const couponCode = params.couponCode?.trim();
  if (couponCode) {
    const copyCodeIndex = findCopyCodeButtonIndex(template);
    if (copyCodeIndex !== null) {
      components.push({
        type: 'button',
        sub_type: 'copy_code',
        index: copyCodeIndex,
        parameters: [{ type: 'coupon_code', coupon_code: couponCode }],
      });
    }
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

    const values = type === 'BODY' ? params?.body : params?.header;
    if (values?.length) {
      values.forEach((value, index) => {
        text = text!.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), value);
      });
      if (values[0]) text = text!.replace(/\{\{name\}\}/g, values[0]);
    }

    if (type === 'HEADER' || type === 'BODY' || type === 'FOOTER') {
      lines.push(text);
    }
  }

  return lines.join('\n\n') || (fallbackName ? `Template: ${fallbackName}` : '');
}
