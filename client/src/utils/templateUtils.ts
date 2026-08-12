import type { MessageTemplate } from '../types';
import { getTemplateParts } from '../components/inbox/WhatsAppPreview';
import { messagingConsent } from './plainLanguage';

export function getTemplateRejectedReason(reason?: string): string | null {
  if (!reason) return null;
  const trimmed = reason.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (['none', 'n/a', 'na', '-', 'null'].includes(lower)) return null;
  return trimmed;
}

export function countTemplateVars(text?: string): number {
  if (!text) return 0;
  const nums = extractTemplateVarNumbers(text);
  return nums.length ? Math.max(...nums) : 0;
}

/** Returns sorted unique variable indices found in text (e.g. {{1}}, {{2}}). */
export function extractTemplateVarNumbers(text?: string): number[] {
  if (!text) return [];
  const matches = text.match(/\{\{\d+\}\}/g) || [];
  return [...new Set(matches.map((m) => parseInt(m.replace(/[{}]/g, ''), 10)))].sort((a, b) => a - b);
}

function validateVariableText(field: string, text: string, issues: TemplateValidationIssue[]) {
  if (!text.includes('{{')) return;

  const nums = extractTemplateVarNumbers(text);
  const expected = Array.from({ length: nums.length ? Math.max(...nums) : 0 }, (_, i) => i + 1);
  const missing = expected.filter((n) => !nums.includes(n));
  if (missing.length) {
    issues.push({
      field,
      message: `Use sequential placeholders starting at {{1}} — missing {{${missing[0]}}}`,
      severity: 'error',
    });
  }

  const invalid = text.match(/\{\{(?!\d+\}\})[^}]*\}\}/g);
  if (invalid?.length) {
    issues.push({
      field,
      message: 'Only numbered placeholders are allowed (e.g. {{1}}, {{2}})',
      severity: 'error',
    });
  }

  const trimmed = text.trim();
  if (/^\{\{\d+\}\}/.test(trimmed)) {
    issues.push({
      field,
      message: 'Text cannot start with a placeholder',
      severity: 'error',
    });
  }
  if (/\{\{\d+\}\}$/.test(trimmed)) {
    issues.push({
      field,
      message: 'Text cannot end with a placeholder',
      severity: 'error',
    });
  }

  if (/\{\{\d+\}\}\s*\{\{\d+\}\}/.test(text)) {
    issues.push({
      field,
      message: 'Placeholders cannot be placed directly next to each other — add text between them',
      severity: 'error',
    });
  }
}

function validateButtons(
  buttons: Array<{ type: string; text: string; url?: string; phone_number?: string; example?: string }>,
  issues: TemplateValidationIssue[]
) {
  if (!buttons.length) return;

  const filled = buttons.filter((b) => b.text.trim());
  const labels = filled.map((b) => b.text.trim().toLowerCase());
  if (new Set(labels).size !== labels.length) {
    issues.push({
      field: 'buttons',
      message: 'Each button label must be unique',
      severity: 'error',
    });
  }

  const qr = filled.filter((b) => b.type === 'QUICK_REPLY');
  const url = filled.filter((b) => b.type === 'URL');
  const phone = filled.filter((b) => b.type === 'PHONE_NUMBER');
  const copy = filled.filter((b) => b.type === 'COPY_CODE');

  if (url.length > 2) {
    issues.push({ field: 'buttons', message: 'Maximum 2 website (URL) buttons', severity: 'error' });
  }
  if (phone.length > 1) {
    issues.push({ field: 'buttons', message: 'Maximum 1 call (phone) button', severity: 'error' });
  }
  if (copy.length > 1) {
    issues.push({ field: 'buttons', message: 'Maximum 1 copy-code button', severity: 'error' });
  }

  for (const btn of filled) {
    if (btn.text.length > 25) {
      issues.push({
        field: 'buttons',
        message: `Button "${btn.text.slice(0, 12)}…" exceeds 25 characters`,
        severity: 'error',
      });
    }
    if (btn.type === 'URL' && btn.url) {
      const lower = btn.url.toLowerCase();
      if (lower.includes('wa.me') || lower.includes('whatsapp.com')) {
        issues.push({
          field: 'buttons',
          message: 'URL buttons cannot link to wa.me or whatsapp.com',
          severity: 'error',
        });
      }
      if (/bit\.ly|tinyurl\.com|t\.co\/|goo\.gl|ow\.ly/.test(lower)) {
        issues.push({
          field: 'buttons',
          message: 'Avoid URL shorteners (bit.ly, t.co) — WhatsApp may reject them',
          severity: 'warning',
        });
      }
      if (btn.url.trim() && !/^https:\/\//i.test(btn.url.trim())) {
        issues.push({
          field: 'buttons',
          message: 'Website URLs should use HTTPS for better approval odds',
          severity: 'warning',
        });
      }
    }
  }

  if (qr.length && (url.length || phone.length || copy.length)) {
    const types = filled.map((b) => (b.type === 'QUICK_REPLY' ? 'QR' : 'CTA'));
    const ctaFirst = types.indexOf('CTA');
    const qrFirst = types.indexOf('QR');
    if (ctaFirst >= 0 && qrFirst >= 0 && ctaFirst > qrFirst) {
      issues.push({
        field: 'buttons',
        message: 'Group action buttons (URL, Call, Copy) before quick-reply buttons',
        severity: 'error',
      });
    }
  }
}

export function getTemplateBodyText(template: MessageTemplate): string {
  return template.body || template.components?.find((c) => c.type === 'BODY')?.text || '';
}

export function getTemplateHeaderText(template: MessageTemplate): string {
  return template.header || template.components?.find((c) => c.type === 'HEADER')?.text || '';
}

export function getTemplateHeaderFormat(template: MessageTemplate): string | undefined {
  const header = template.components?.find((c) => c.type?.toUpperCase() === 'HEADER') as
    | { format?: string }
    | undefined;
  return header?.format?.toUpperCase();
}

export function getTemplatePreviewSnippet(template: MessageTemplate, max = 80): string {
  const body = getTemplateParts(template).body;
  if (!body || body === '—') return '';
  return body.length > max ? `${body.slice(0, max)}…` : body;
}

export interface TemplateGroup {
  name: string;
  variants: MessageTemplate[];
  primary: MessageTemplate;
}

export function groupTemplatesByName(templates: MessageTemplate[]): TemplateGroup[] {
  const map = new Map<string, MessageTemplate[]>();
  for (const t of templates) {
    const list = map.get(t.name) || [];
    list.push(t);
    map.set(t.name, list);
  }

  return Array.from(map.entries()).map(([name, variants]) => {
    const sorted = [...variants].sort((a, b) => a.language.localeCompare(b.language));
    const primary =
      sorted.find((v) => v.status === 'APPROVED') ||
      sorted.find((v) => v.status === 'PENDING') ||
      sorted[0];
    return { name, variants: sorted, primary };
  });
}

export function getQualityLabel(score?: string): { label: string; tone: string } | null {
  if (!score) return null;
  const upper = score.toUpperCase();
  if (upper === 'UNKNOWN' || upper === 'NA' || upper === 'N/A') return null;
  if (upper === 'GREEN') return { label: 'High quality', tone: 'text-emerald-700' };
  if (upper === 'YELLOW') return { label: 'Medium quality', tone: 'text-amber-700' };
  if (upper === 'RED') return { label: 'Low quality', tone: 'text-red-600' };
  return null;
}

export interface TemplateValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export function validateTemplateForm(form: {
  name: string;
  body: string;
  header: string;
  footer: string;
  category: string;
  bodyExamples: string[];
  headerExamples: string[];
  headerFormat: string;
  headerMediaHandle: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string; example?: string }>;
}): TemplateValidationIssue[] {
  const issues: TemplateValidationIssue[] = [];

  if (!form.name.trim()) {
    issues.push({ field: 'name', message: 'Template name is required', severity: 'error' });
  } else if (!/^[a-z0-9_]+$/.test(form.name)) {
    issues.push({
      field: 'name',
      message: 'Use lowercase letters, numbers, and underscores only',
      severity: 'error',
    });
  } else if (form.name.length > 512) {
    issues.push({ field: 'name', message: 'Template name must be 512 characters or fewer', severity: 'error' });
  }

  if (!form.body.trim()) {
    issues.push({ field: 'body', message: 'Body text is required', severity: 'error' });
  } else if (form.body.length > 1024) {
    issues.push({ field: 'body', message: 'Body must be 1,024 characters or fewer', severity: 'error' });
  } else {
    validateVariableText('body', form.body, issues);
  }

  if (form.header && form.header.length > 60) {
    issues.push({ field: 'header', message: 'Header must be 60 characters or fewer', severity: 'error' });
  } else if (form.header) {
    validateVariableText('header', form.header, issues);
  }

  if (form.footer && form.footer.length > 60) {
    issues.push({ field: 'footer', message: 'Footer must be 60 characters or fewer', severity: 'error' });
  }

  const bodyVars = countTemplateVars(form.body);
  if (bodyVars > 0) {
    const filled = form.bodyExamples.filter((v) => v.trim()).length;
    if (filled < bodyVars) {
      issues.push({
        field: 'bodyExamples',
        message: `Add sample values for all ${bodyVars} body variable(s)`,
        severity: 'error',
      });
    }
  }

  const headerVars = countTemplateVars(form.header);
  if (headerVars > 0) {
    const filled = form.headerExamples.filter((v) => v.trim()).length;
    if (filled < headerVars) {
      issues.push({
        field: 'headerExamples',
        message: `Add sample values for all ${headerVars} header variable(s)`,
        severity: 'error',
      });
    }
  }

  if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(form.headerFormat) && !form.headerMediaHandle) {
    issues.push({
      field: 'headerMediaHandle',
      message: 'Upload a sample file for the media header',
      severity: 'error',
    });
  }

  if (form.category === 'MARKETING' && !form.footer.toLowerCase().includes('stop')) {
    issues.push({
      field: 'footer',
      message: messagingConsent.templateStopHint,
      severity: 'warning',
    });
  }

  if (form.category === 'UTILITY' && form.body) {
    const promoWords = /\b(sale|discount|offer|buy now|limited time|% off|coupon|deal)\b/i;
    if (promoWords.test(form.body) || promoWords.test(form.header)) {
      issues.push({
        field: 'category',
        message: 'Promotional language may cause Utility templates to be rejected — consider Marketing category',
        severity: 'warning',
      });
    }
  }

  const emojiCount = (form.body.match(/\p{Extended_Pictographic}/gu) || []).length;
  if (emojiCount > 10) {
    issues.push({
      field: 'body',
      message: `Too many emojis in body (${emojiCount}). WhatsApp may reject templates with excessive emojis.`,
      severity: 'warning',
    });
  }

  if (form.buttons?.length) {
    validateButtons(form.buttons, issues);
    for (const btn of form.buttons) {
      if (!btn.text.trim()) continue;
      if (btn.type === 'URL' && !btn.url?.trim()) {
        issues.push({ field: 'buttons', message: 'URL is required for website buttons', severity: 'error' });
      }
      if (btn.type === 'PHONE_NUMBER' && !btn.phone_number?.trim()) {
        issues.push({ field: 'buttons', message: 'Phone number is required for call buttons', severity: 'error' });
      }
      if (btn.type === 'COPY_CODE' && !btn.example?.trim()) {
        issues.push({ field: 'buttons', message: 'Sample code is required for copy-code buttons', severity: 'error' });
      }
    }
  }

  return issues;
}

export const LANGUAGE_OPTIONS = [
  { value: 'en_US', label: 'English (US)' },
  { value: 'en_GB', label: 'English (UK)' },
  { value: 'hi', label: 'Hindi' },
  { value: 'hi_IN', label: 'Hindi (India)' },
  { value: 'es', label: 'Spanish' },
  { value: 'es_ES', label: 'Spanish (Spain)' },
  { value: 'pt_BR', label: 'Portuguese (Brazil)' },
  { value: 'ar', label: 'Arabic' },
];

export const CATEGORY_OPTIONS = [
  { value: 'UTILITY', label: 'Utility' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
];

export const HEADER_FORMAT_OPTIONS = [
  { value: 'NONE', label: 'No header' },
  { value: 'TEXT', label: 'Text header' },
  { value: 'IMAGE', label: 'Image header' },
  { value: 'VIDEO', label: 'Video header' },
  { value: 'DOCUMENT', label: 'Document header' },
];

export interface ApprovalChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  severity: 'error' | 'warning';
  hint?: string;
}

export function getTemplateApprovalChecklist(form: {
  name: string;
  body: string;
  header: string;
  footer: string;
  category: string;
  bodyExamples: string[];
  headerExamples: string[];
  headerFormat: string;
  headerMediaHandle: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string; example?: string }>;
}): ApprovalChecklistItem[] {
  const issues = validateTemplateForm(form);
  const errors = new Set(issues.filter((i) => i.severity === 'error').map((i) => i.field));
  const warnings = new Set(issues.filter((i) => i.severity === 'warning').map((i) => i.field));

  const bodyVars = countTemplateVars(form.body);
  const fixedText = form.body.replace(/\{\{\d+\}\}/g, '').trim();
  const mostlyVariables = bodyVars > 0 && fixedText.length < 12;

  const emojiCount = (form.body.match(/\p{Extended_Pictographic}/gu) || []).length;

  const items: ApprovalChecklistItem[] = [
    {
      id: 'name',
      label: 'Template name follows WhatsApp guidelines',
      passed: !errors.has('name') && Boolean(form.name.trim()),
      severity: 'error',
    },
    {
      id: 'body',
      label: 'Body has clear, readable text',
      passed: Boolean(form.body.trim()) && !errors.has('body') && !mostlyVariables,
      severity: 'error',
      hint: mostlyVariables ? 'Add more fixed text around your placeholders' : undefined,
    },
    {
      id: 'samples',
      label: 'Sample values provided for all variables',
      passed: !errors.has('bodyExamples') && !errors.has('headerExamples'),
      severity: 'error',
    },
    {
      id: 'category',
      label: 'Category matches message content',
      passed: !errors.has('category') && !warnings.has('category'),
      severity: warnings.has('category') ? 'warning' : 'error',
    },
    {
      id: 'media',
      label: 'Media header sample uploaded (if applicable)',
      passed: !errors.has('headerMediaHandle'),
      severity: 'error',
    },
    {
      id: 'buttons',
      label: 'Buttons configured correctly',
      passed: !errors.has('buttons'),
      severity: 'error',
    },
    {
      id: 'marketing',
      label: 'Marketing opt-out included in footer',
      passed:
        form.category !== 'MARKETING' ||
        form.footer.toLowerCase().includes('stop') ||
        !warnings.has('footer'),
      severity: 'warning',
    },
    {
      id: 'content',
      label: 'No prohibited content detected',
      passed: emojiCount <= 10 && !errors.has('body'),
      severity: 'warning',
      hint: emojiCount > 10 ? 'Reduce emojis in the body text' : undefined,
    },
  ];

  return items;
}
