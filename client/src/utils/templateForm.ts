import type { MessageTemplate, TemplateButton, TemplateLibraryEntry } from '../types';
import { countTemplateVars } from './templateUtils';

export type TemplateButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';
export type HeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';

export interface TemplateButtonForm {
  type: TemplateButtonType;
  text: string;
  url: string;
  phone_number: string;
  example: string;
}

export interface TemplateVariableMeta {
  scope: 'body' | 'header';
  index: number;
  description: string;
  suggestedSource?: 'contact.name' | 'contact.phone' | 'contact.email' | 'custom';
}

/** Token written into campaign/inbox params; resolved per-recipient at send time. */
export const CONTACT_SOURCE_TOKEN: Record<string, string> = {
  'contact.name': '{{name}}',
  'contact.phone': '{{phone}}',
  'contact.email': '{{email}}',
};

/** Reverse lookup: sample/token value → source key. */
export function sourceFromParamValue(value: string): string | undefined {
  const v = value.trim();
  for (const [source, token] of Object.entries(CONTACT_SOURCE_TOKEN)) {
    if (token === v) return source;
  }
  return undefined;
}

export function tokenForSource(source?: string): string {
  return (source && CONTACT_SOURCE_TOKEN[source]) || '';
}

/** Read the saved variable mapping for a template name (set in the wizard's Review step). */
export function loadTemplateVariableMeta(templateName: string): TemplateVariableMeta[] {
  try {
    const raw = localStorage.getItem(`samyoj_template_meta_${templateName}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist the wizard's variable mapping so campaigns/inbox can auto-fill mapped variables. */
export function saveTemplateVariableMeta(templateName: string, meta: TemplateVariableMeta[]) {
  try {
    if (!meta?.length) return;
    localStorage.setItem(`samyoj_template_meta_${templateName}`, JSON.stringify(meta));
  } catch {
    /* storage full/blocked — non-fatal */
  }
}

/** Human label for a mapped source, e.g. "customer name". */
export function sourceLabel(source?: string): string {
  if (source === 'contact.name') return 'customer name';
  if (source === 'contact.phone') return 'phone number';
  if (source === 'contact.email') return 'email';
  return '';
}

/** Sample values so previews show realistic text instead of a raw {{name}} token. */
export const TOKEN_PREVIEW_SAMPLE: Record<string, string> = {
  '{{name}}': 'Rahul',
  '{{phone}}': '+91 98765 43210',
  '{{email}}': 'rahul@example.com',
};

/** Replace a resolution token with a friendly sample for live previews (send path is unaffected). */
export function previewValueForParam(value: string): string {
  return TOKEN_PREVIEW_SAMPLE[value.trim()] ?? value;
}

/** Map a params array for preview, converting any tokens to samples. */
export function previewParams(params: string[]): string[] {
  return params.map(previewValueForParam);
}

export interface TemplateFormState {
  name: string;
  language: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  body: string;
  header: string;
  headerFormat: HeaderFormat;
  headerMediaHandle: string;
  footer: string;
  buttons: TemplateButtonForm[];
  bodyExamples: string[];
  headerExamples: string[];
  variableMeta: TemplateVariableMeta[];
  addSecurityRecommendation: boolean;
  authType: 'OTP' | 'ONE_TAP';
}

export const emptyTemplateForm: TemplateFormState = {
  name: '',
  language: 'en_US',
  category: 'UTILITY',
  body: '',
  header: '',
  headerFormat: 'NONE',
  headerMediaHandle: '',
  footer: '',
  buttons: [],
  bodyExamples: [],
  headerExamples: [],
  variableMeta: [],
  addSecurityRecommendation: true,
  authType: 'OTP',
};

export function emptyTemplateButton(type: TemplateButtonType = 'QUICK_REPLY'): TemplateButtonForm {
  return { type, text: '', url: '', phone_number: '', example: '' };
}

export function buttonsFromTemplate(template: MessageTemplate | TemplateLibraryEntry): TemplateButtonForm[] {
  const raw = template.buttons ?? template.components?.find((c) => c.type === 'BUTTONS')?.buttons;
  if (!raw?.length) return [];

  return raw
    .filter((b) => ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE'].includes(b.type))
    .map((b) => ({
      type: b.type as TemplateButtonType,
      text: b.text || '',
      url: b.url || '',
      phone_number: b.phone_number || '',
      example: '',
    }));
}

function syncExamples(text: string, current: string[]): string[] {
  const count = countTemplateVars(text);
  return Array.from({ length: count }, (_, i) => current[i] || '');
}

export function inferVariableDescription(text: string, varIndex: number): string {
  const parts = text.split(`{{${varIndex}}}`);
  const before = (parts[0] || '').toLowerCase();
  if (/\b(hi|hello|dear|hey)\s*$/.test(before.trim())) return 'Customer name';
  if (before.includes('order')) return 'Order number';
  if (before.includes('appointment') || before.includes('date')) return 'Date or time';
  if (before.includes('amount') || before.includes('₹') || before.includes('rs')) return 'Amount';
  if (before.includes('code') || before.includes('otp') || before.includes('verification'))
    return 'Verification code';
  if (before.includes('track') || before.includes('reference') || before.includes('id'))
    return 'Reference ID';
  const defaults = [
    'Customer name',
    'Order number',
    'Date or time',
    'Amount',
    'Reference ID',
    'Product name',
    'Location',
  ];
  return defaults[varIndex - 1] || `Variable ${varIndex}`;
}

function syncVariableMeta(
  form: Pick<TemplateFormState, 'body' | 'header' | 'variableMeta'>,
): TemplateVariableMeta[] {
  const bodyCount = countTemplateVars(form.body);
  const headerCount = countTemplateVars(form.header);
  const existing = form.variableMeta || [];
  const next: TemplateVariableMeta[] = [];

  for (let i = 1; i <= headerCount; i++) {
    const prev = existing.find((m) => m.scope === 'header' && m.index === i);
    next.push({
      scope: 'header',
      index: i,
      description: prev?.description || inferVariableDescription(form.header, i),
      suggestedSource: prev?.suggestedSource,
    });
  }
  for (let i = 1; i <= bodyCount; i++) {
    const prev = existing.find((m) => m.scope === 'body' && m.index === i);
    next.push({
      scope: 'body',
      index: i,
      description: prev?.description || inferVariableDescription(form.body, i),
      suggestedSource:
        prev?.suggestedSource ||
        (i === 1 && /\b(hi|hello|dear)\s*\{\{1\}\}/i.test(form.body) ? 'contact.name' : 'custom'),
    });
  }
  return next;
}

export function formFromLibraryEntry(entry: TemplateLibraryEntry): TemplateFormState {
  const body = entry.body || '';
  const header = entry.header || '';
  const samples = entry.body_params || [];
  return syncFormExamples({
    name: '',
    language: entry.language || 'en_US',
    category:
      entry.category === 'MARKETING' || entry.category === 'AUTHENTICATION'
        ? entry.category
        : 'UTILITY',
    body,
    header,
    headerFormat: header ? 'TEXT' : 'NONE',
    headerMediaHandle: '',
    footer: entry.footer || '',
    buttons: buttonsFromTemplate(entry),
    bodyExamples: samples.length ? samples : syncExamples(body, []),
    headerExamples: syncExamples(header, entry.header_params || []),
    variableMeta: [],
    addSecurityRecommendation: true,
    authType: 'OTP',
  });
}

export function formFromMessageTemplate(template: MessageTemplate): TemplateFormState {
  const components = template.components ?? [];
  const body = components.find((c) => c.type === 'BODY')?.text || '';
  const header = components.find((c) => c.type === 'HEADER')?.text || '';
  const headerComp = components.find((c) => c.type === 'HEADER') as { format?: string } | undefined;
  const format = (headerComp?.format?.toUpperCase() || (header ? 'TEXT' : 'NONE')) as HeaderFormat;

  return syncFormExamples({
    name: template.name,
    language: template.language || 'en_US',
    category: (template.category as TemplateFormState['category']) || 'UTILITY',
    body,
    header,
    headerFormat: format === 'TEXT' && !header ? 'NONE' : format,
    headerMediaHandle: '',
    footer: components.find((c) => c.type === 'FOOTER')?.text || '',
    buttons: buttonsFromTemplate(template),
    bodyExamples: syncExamples(body, []),
    headerExamples: syncExamples(header, []),
    variableMeta: [],
    addSecurityRecommendation: true,
    authType: 'OTP',
  });
}

export function duplicateTemplateForm(template: MessageTemplate): TemplateFormState {
  const base = formFromMessageTemplate(template);
  return { ...base, name: `${template.name}_copy` };
}

export function buildCreatePayload(form: TemplateFormState) {
  return {
    name: form.name,
    language: form.language,
    category: form.category,
    body: form.body,
    header: form.headerFormat === 'TEXT' ? form.header || undefined : undefined,
    headerFormat: form.headerFormat,
    headerMediaHandle: ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(form.headerFormat)
      ? form.headerMediaHandle || undefined
      : undefined,
    footer: form.footer || undefined,
    bodyExamples: form.bodyExamples.filter(Boolean).length ? form.bodyExamples : undefined,
    headerExamples: form.headerExamples.filter(Boolean).length ? form.headerExamples : undefined,
    addSecurityRecommendation:
      form.category === 'AUTHENTICATION' ? form.addSecurityRecommendation : undefined,
    authType: form.category === 'AUTHENTICATION' ? form.authType : undefined,
    buttons: form.buttons.length
      ? form.buttons.map((b) => ({
          type: b.type,
          text: b.text,
          ...(b.type === 'URL' ? { url: b.url } : {}),
          ...(b.type === 'PHONE_NUMBER' ? { phone_number: b.phone_number } : {}),
          ...(b.type === 'COPY_CODE' ? { example: b.example } : {}),
        }))
      : undefined,
  };
}

export function getTemplateButtons(
  template: MessageTemplate | TemplateLibraryEntry
): TemplateButton[] {
  if (template.buttons?.length) return template.buttons;
  return template.components?.find((c) => c.type === 'BUTTONS')?.buttons || [];
}

export function syncFormExamples(form: TemplateFormState): TemplateFormState {
  const bodyExamples = syncExamples(form.body, form.bodyExamples);
  const headerExamples = syncExamples(form.header, form.headerExamples);
  const withExamples = {
    ...form,
    bodyExamples,
    headerExamples,
  };
  return {
    ...withExamples,
    variableMeta: syncVariableMeta(withExamples),
  };
}

/** Purpose-based starter recipes: pre-fill category/body/vars with pre-mapped contact sources. */
export interface TemplatePurposePreset {
  id: string;
  label: string;
  hint: string;
  category: TemplateFormState['category'];
  body: string;
  footer?: string;
  /** description per body var index (1-based) → auto-mapped source */
  variables: Array<{ description: string; source: TemplateVariableMeta['suggestedSource'] }>;
}

export const TEMPLATE_PURPOSE_PRESETS: TemplatePurposePreset[] = [
  {
    id: 'order_update',
    label: 'Order update',
    hint: 'Confirm or update a customer order',
    category: 'UTILITY',
    body: 'Hi {{1}}, your order {{2}} has been confirmed. We will notify you once it ships.',
    variables: [
      { description: 'Customer name', source: 'contact.name' },
      { description: 'Order number', source: 'custom' },
    ],
  },
  {
    id: 'appointment_reminder',
    label: 'Appointment reminder',
    hint: 'Remind about an upcoming booking',
    category: 'UTILITY',
    body: 'Hi {{1}}, this is a reminder for your appointment on {{2}}. Reply to reschedule.',
    variables: [
      { description: 'Customer name', source: 'contact.name' },
      { description: 'Date or time', source: 'custom' },
    ],
  },
  {
    id: 'offer_code',
    label: 'Offer / promo code',
    hint: 'Send a discount to opted-in customers',
    category: 'MARKETING',
    body: 'Hi {{1}}, here is your exclusive offer. Use code {{2}} at checkout.',
    footer: 'Reply STOP to unsubscribe',
    variables: [
      { description: 'Customer name', source: 'contact.name' },
      { description: 'Offer code', source: 'custom' },
    ],
  },
  {
    id: 'otp_login',
    label: 'OTP / verification',
    hint: 'Login or verification code',
    category: 'AUTHENTICATION',
    body: '{{1}} is your verification code. Do not share it with anyone.',
    variables: [{ description: 'Verification code', source: 'custom' }],
  },
  {
    id: 'feedback',
    label: 'Feedback request',
    hint: 'Ask how their experience was',
    category: 'UTILITY',
    body: 'Hi {{1}}, thank you for your recent visit. How was your experience with us?',
    variables: [{ description: 'Customer name', source: 'contact.name' }],
  },
  {
    id: 'welcome',
    label: 'Welcome message',
    hint: 'Greet a new subscriber',
    category: 'MARKETING',
    body: 'Welcome {{1}}! We are glad to have you. Explore our latest updates anytime.',
    footer: 'Reply STOP to unsubscribe',
    variables: [{ description: 'Customer name', source: 'contact.name' }],
  },
];

export function applyPurposePreset(form: TemplateFormState, preset: TemplatePurposePreset): TemplateFormState {
  const variableMeta: TemplateVariableMeta[] = preset.variables.map((v, i) => ({
    scope: 'body' as const,
    index: i + 1,
    description: v.description,
    suggestedSource: v.source,
  }));
  return syncFormExamples({
    ...form,
    category: preset.category,
    body: preset.body,
    footer: preset.footer ?? form.footer,
    variableMeta,
  });
}

export const AUTO_FILL_SAMPLES: Record<string, string[]> = {
  'Customer name': ['Rahul', 'Priya', 'Amit'],
  'Order number': ['ORD12345', 'ORD98765', 'ORD55443'],
  'Date or time': ['12 Aug 2026', 'Tomorrow 3 PM', 'Friday 10 AM'],
  Amount: ['₹1,299', '₹499', '₹2,450'],
  'Reference ID': ['REF-8821', 'TRK-4412', 'ID-99001'],
  'Verification code': ['482910', '739201', '105482'],
  'Product name': ['Premium Plan', 'Blue Sneakers', 'Annual subscription'],
  Location: ['Mumbai', 'Delhi', 'Bangalore'],
};
