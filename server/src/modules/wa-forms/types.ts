import { z } from 'zod';

export const waFormFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  type: z.enum(['text', 'email', 'phone', 'number']),
  required: z.boolean().optional(),
});

export const createWaFormSchema = z.object({
  name: z.string().min(2).max(80),
  title: z.string().min(2).max(80),
  submitLabel: z.string().min(1).max(20).default('Submit'),
  fields: z.array(waFormFieldSchema).min(1).max(8),
});

export type WaFormField = z.infer<typeof waFormFieldSchema>;
export type CreateWaFormInput = z.infer<typeof createWaFormSchema>;

export interface WaFormSummary {
  id: string;
  name: string;
  status: string;
  categories: string[];
  validationErrors: string[];
}
