import type { z } from 'zod';
import type { createTemplateSchema } from './types';

type TemplateInput = z.infer<typeof createTemplateSchema>;

function buildExampleParams(values: string[]) {
  return { body_text: [values] };
}

function buildHeaderExample(format: string, values?: string[], headerHandle?: string) {
  if (format === 'TEXT' && values?.length) {
    return { header_text: values };
  }
  if (format !== 'TEXT' && headerHandle) {
    return { header_handle: [headerHandle] };
  }
  return undefined;
}

export function buildTemplateComponents(data: TemplateInput) {
  const components: Array<Record<string, unknown>> = [];
  const headerFormat = data.headerFormat || 'TEXT';

  if (headerFormat !== 'NONE') {
    if (headerFormat === 'TEXT' && data.header) {
      const headerComp: Record<string, unknown> = {
        type: 'HEADER',
        format: 'TEXT',
        text: data.header,
      };
      const example = buildHeaderExample('TEXT', data.headerExamples);
      if (example) headerComp.example = example;
      components.push(headerComp);
    } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && data.headerMediaHandle) {
      const headerComp: Record<string, unknown> = {
        type: 'HEADER',
        format: headerFormat,
        example: buildHeaderExample(headerFormat, undefined, data.headerMediaHandle),
      };
      components.push(headerComp);
    }
  }

  const bodyComp: Record<string, unknown> = {
    type: 'BODY',
    text: data.body,
  };

  if (data.category === 'AUTHENTICATION' && data.addSecurityRecommendation !== false) {
    bodyComp.add_security_recommendation = true;
  }

  if (data.bodyExamples?.length) {
    bodyComp.example = buildExampleParams(data.bodyExamples);
  }
  components.push(bodyComp);

  if (data.footer) {
    components.push({ type: 'FOOTER', text: data.footer });
  }

  if (data.buttons?.length) {
    components.push({
      type: 'BUTTONS',
      buttons: data.buttons.map((btn) => {
        const base: Record<string, unknown> = { type: btn.type, text: btn.text };
        if (btn.type === 'URL' && btn.url) base.url = btn.url;
        if (btn.type === 'PHONE_NUMBER' && btn.phone_number) base.phone_number = btn.phone_number;
        if (btn.type === 'COPY_CODE' && btn.example) base.example = [btn.example];
        return base;
      }),
    });
  }

  return components;
}
