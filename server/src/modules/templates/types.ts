import { z } from 'zod';

export const templateButtonSchema = z
  .object({
    type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE']),
    text: z.string().min(1).max(25),
    url: z.string().max(2000).optional(),
    phone_number: z.string().max(20).optional(),
    example: z.string().max(15).optional(),
  })
  .superRefine((btn, ctx) => {
    if (btn.type === 'URL' && !btn.url?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'URL is required for URL buttons', path: ['url'] });
    }
    if (btn.type === 'PHONE_NUMBER' && !btn.phone_number?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Phone number is required for call buttons',
        path: ['phone_number'],
      });
    }
    if (btn.type === 'COPY_CODE' && !btn.example?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Sample code is required for copy-code buttons',
        path: ['example'],
      });
    }
  });

export const createTemplateSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(512)
      .regex(/^[a-z0-9_]+$/, 'Name must be lowercase letters, numbers, and underscores only'),
    language: z.string().min(2).default('en_US'),
    category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
    body: z.string().min(1).max(1024),
    header: z.string().max(60).optional(),
    headerFormat: z.enum(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).default('TEXT'),
    headerMediaHandle: z.string().optional(),
    footer: z.string().max(60).optional(),
    buttons: z.array(templateButtonSchema).max(10).optional(),
    bodyExamples: z.array(z.string().max(200)).optional(),
    headerExamples: z.array(z.string().max(60)).optional(),
    authType: z.enum(['OTP', 'ONE_TAP']).optional(),
    addSecurityRecommendation: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const bodyVarCount = (data.body.match(/\{\{\d+\}\}/g) || []).length;
    if (bodyVarCount > 0) {
      if (!data.bodyExamples?.length || data.bodyExamples.length < bodyVarCount) {
        ctx.addIssue({
          code: 'custom',
          message: `Provide sample values for all ${bodyVarCount} body variable(s)`,
          path: ['bodyExamples'],
        });
      }
    }

    const headerVarCount = data.header ? (data.header.match(/\{\{\d+\}\}/g) || []).length : 0;
    if (headerVarCount > 0) {
      if (!data.headerExamples?.length || data.headerExamples.length < headerVarCount) {
        ctx.addIssue({
          code: 'custom',
          message: `Provide sample values for all ${headerVarCount} header variable(s)`,
          path: ['headerExamples'],
        });
      }
    }

    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(data.headerFormat) && !data.headerMediaHandle) {
      ctx.addIssue({
        code: 'custom',
        message: 'Upload a sample file for media headers',
        path: ['headerMediaHandle'],
      });
    }
  });

export const createFromLibrarySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/, 'Name must be lowercase letters, numbers, and underscores only'),
  language: z.string().min(2).default('en_US'),
  libraryTemplateName: z.string().min(1),
  libraryTemplateButtonInputs: z.array(z.record(z.unknown())).optional(),
});

export const testSendSchema = z.object({
  phone: z.string().min(8),
  language: z.string().optional(),
  templateParams: z
    .object({
      body: z.array(z.string()).optional(),
      header: z.array(z.string()).optional(),
      headerMediaUrl: z.string().url().optional(),
    })
    .optional(),
});
