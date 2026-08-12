import { z } from 'zod';

function extractVarNumbers(text: string): number[] {
  const matches = text.match(/\{\{\d+\}\}/g) || [];
  return [...new Set(matches.map((m) => parseInt(m.replace(/[{}]/g, ''), 10)))].sort((a, b) => a - b);
}

function validatePlaceholderText(path: string, text: string, ctx: z.RefinementCtx) {
  if (!text.includes('{{')) return;
  const nums = extractVarNumbers(text);
  const expected = Array.from({ length: nums.length ? Math.max(...nums) : 0 }, (_, i) => i + 1);
  const missing = expected.filter((n) => !nums.includes(n));
  if (missing.length) {
    ctx.addIssue({
      code: 'custom',
      message: `Use sequential placeholders starting at {{1}} — missing {{${missing[0]}}}`,
      path: [path],
    });
  }
  const trimmed = text.trim();
  if (/^\{\{\d+\}\}/.test(trimmed)) {
    ctx.addIssue({ code: 'custom', message: 'Text cannot start with a placeholder', path: [path] });
  }
  if (/\{\{\d+\}\}$/.test(trimmed)) {
    ctx.addIssue({ code: 'custom', message: 'Text cannot end with a placeholder', path: [path] });
  }
}

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

    validatePlaceholderText('body', data.body, ctx);
    if (data.header) validatePlaceholderText('header', data.header, ctx);

    if (data.buttons?.length) {
      const filled = data.buttons.filter((b) => b.text.trim());
      const labels = filled.map((b) => b.text.trim().toLowerCase());
      if (new Set(labels).size !== labels.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'Each button label must be unique',
          path: ['buttons'],
        });
      }
      const urlCount = filled.filter((b) => b.type === 'URL').length;
      if (urlCount > 2) {
        ctx.addIssue({ code: 'custom', message: 'Maximum 2 URL buttons', path: ['buttons'] });
      }
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
