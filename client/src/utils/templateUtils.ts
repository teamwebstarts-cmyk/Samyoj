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
  const matches = text.match(/\{\{\d+\}\}/g) || [];
  const nums = matches.map((m) => parseInt(m.replace(/[{}]/g, ''), 10));
  return nums.length ? Math.max(...nums) : 0;
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
  }

  if (!form.body.trim()) {
    issues.push({ field: 'body', message: 'Body text is required', severity: 'error' });
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
        message: `Add sample values for all ${headerVars} body variable(s)`,
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
