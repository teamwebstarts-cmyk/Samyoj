import { z } from 'zod';

export const metaFlowFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  type: z.enum(['text', 'email', 'phone', 'number', 'textarea', 'dropdown', 'date']),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

export const createFlowAssetSchema = z
  .object({
    name: z.string().min(2).max(80),
    description: z.string().max(500).optional(),
    categories: z.array(z.string()).default(['OTHER']),
    flowJson: z.record(z.unknown()).optional(),
    title: z.string().min(2).max(80).optional(),
    submitLabel: z.string().min(1).max(20).default('Submit'),
    fields: z.array(metaFlowFieldSchema).optional(),
  })
  .refine((data) => data.flowJson || (data.title && data.fields && data.fields.length > 0), {
    message: 'Provide flowJson or title with at least one field',
  });

export const updateFlowAssetSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional(),
  categories: z.array(z.string()).optional(),
  flowJson: z.record(z.unknown()).optional(),
  title: z.string().min(2).max(80).optional(),
  submitLabel: z.string().min(1).max(20).optional(),
  fields: z.array(metaFlowFieldSchema).optional(),
});

export type MetaFlowField = z.infer<typeof metaFlowFieldSchema>;
export type CreateFlowAssetInput = z.infer<typeof createFlowAssetSchema>;
export type UpdateFlowAssetInput = z.infer<typeof updateFlowAssetSchema>;

export interface FlowAssetSummary {
  id: string;
  name: string;
  description?: string | null;
  metaFlowId?: string | null;
  metaStatus?: string | null;
  status: string;
  version: number;
  categories: string[];
  validationErrors: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MetaFlowJson {
  version: string;
  screens: Array<{
    id: string;
    title: string;
    terminal?: boolean;
    layout: {
      type: string;
      children: unknown[];
    };
  }>;
}

function inputType(field: MetaFlowField): string {
  if (field.type === 'email') return 'email';
  if (field.type === 'phone') return 'phone';
  if (field.type === 'number') return 'number';
  if (field.type === 'textarea') return 'text';
  return 'text';
}

function fieldComponent(field: MetaFlowField): Record<string, unknown> {
  if (field.type === 'dropdown' && field.options?.length) {
    return {
      type: 'Dropdown',
      name: field.id,
      label: field.label,
      required: Boolean(field.required),
      'data-source': field.options.map((opt) => ({ id: opt, title: opt })),
    };
  }
  if (field.type === 'date') {
    return {
      type: 'DatePicker',
      name: field.id,
      label: field.label,
      required: Boolean(field.required),
    };
  }
  return {
    type: 'TextInput',
    name: field.id,
    label: field.label,
    required: Boolean(field.required),
    'input-type': inputType(field),
  };
}

export function buildFlowAssetJson(input: {
  title: string;
  submitLabel: string;
  fields: MetaFlowField[];
}): MetaFlowJson {
  const formName = 'main_form';
  const payload: Record<string, string> = {};
  for (const field of input.fields) {
    payload[field.id] = `\${form.${field.id}}`;
  }

  const children = input.fields.map(fieldComponent);
  children.push({
    type: 'Footer',
    label: input.submitLabel,
    'on-click-action': {
      name: 'complete',
      payload,
    },
  });

  return {
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
}

export function resolveFlowJson(input: {
  flowJson?: Record<string, unknown>;
  title?: string;
  submitLabel?: string;
  fields?: MetaFlowField[];
}): Record<string, unknown> {
  if (input.flowJson) return input.flowJson;
  if (input.title && input.fields?.length) {
    return buildFlowAssetJson({
      title: input.title,
      submitLabel: input.submitLabel || 'Submit',
      fields: input.fields,
    }) as unknown as Record<string, unknown>;
  }
  throw new Error('flowJson or title+fields required');
}
