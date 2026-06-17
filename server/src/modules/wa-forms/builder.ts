import type { CreateWaFormInput, WaFormField } from './types';

function inputType(field: WaFormField): string {
  if (field.type === 'email') return 'email';
  if (field.type === 'phone') return 'phone';
  if (field.type === 'number') return 'number';
  return 'text';
}

export function buildMetaFlowJson(input: CreateWaFormInput): string {
  const formName = 'main_form';
  const payload: Record<string, string> = {};
  for (const field of input.fields) {
    payload[field.id] = `\${form.${field.id}}`;
  }

  const children = input.fields.map((field) => ({
    type: 'TextInput',
    name: field.id,
    label: field.label,
    required: Boolean(field.required),
    'input-type': inputType(field),
  }));

  children.push({
    type: 'Footer',
    label: input.submitLabel,
    'on-click-action': {
      name: 'complete',
      payload,
    },
  } as never);

  const flow = {
    version: '3.1',
    screens: [
      {
        id: 'MAIN',
        title: input.title,
        terminal: true,
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: formName,
              children,
            },
          ],
        },
      },
    ],
  };

  return JSON.stringify(flow);
}
