import type { MessageTemplate, TemplateButton, TemplateLibraryEntry } from '../types';
import { countTemplateVars } from './templateUtils';
import { normalizeCustomKey } from './customAttributes';

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
  suggestedSource?: 'contact.name' | 'contact.phone' | 'contact.email' | 'custom' | 'contact.custom';
  customKey?: string;
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
  const match = v.match(/^\{\{([a-z][a-z0-9_]*)\}\}$/);
  if (match && !['name', 'phone', 'email'].includes(match[1])) return 'contact.custom';
  return undefined;
}

export function customKeyFromParamValue(value: string): string | undefined {
  const match = value.trim().match(/^\{\{([a-z][a-z0-9_]*)\}\}$/);
  if (!match || ['name', 'phone', 'email'].includes(match[1])) return undefined;
  return match[1];
}

export function tokenForSource(source?: string, customKey?: string): string {
  if (source === 'contact.custom') {
    const key = normalizeCustomKey(customKey || '');
    return key ? `{{${key}}}` : '';
  }
  return (source && CONTACT_SOURCE_TOKEN[source]) || '';
}

export function tokenForMeta(meta?: Pick<TemplateVariableMeta, 'suggestedSource' | 'customKey'>): string {
  if (!meta?.suggestedSource || meta.suggestedSource === 'custom') return '';
  return tokenForSource(meta.suggestedSource, meta.customKey);
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
    const key = `samyoj_template_meta_${templateName}`;
    if (!meta?.length) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(meta));
  } catch {
    /* storage full/blocked — non-fatal */
  }
}

export async function persistTemplateVariableMeta(
  templateName: string,
  meta: TemplateVariableMeta[],
  language?: string,
): Promise<boolean> {
  saveTemplateVariableMeta(templateName, meta);
  try {
    const { templateApi } = await import('../services/api');
    await templateApi.saveVariableMeta(templateName, { language, meta });
    return true;
  } catch {
    return false;
  }
}

export async function fetchTemplateVariableMeta(
  templateName: string,
  language?: string,
): Promise<TemplateVariableMeta[]> {
  try {
    const { templateApi } = await import('../services/api');
    const { data } = await templateApi.getVariableMeta(templateName, language);
    const meta = (data as { data?: { meta?: TemplateVariableMeta[] } })?.data?.meta;
    if (Array.isArray(meta)) {
      saveTemplateVariableMeta(templateName, meta);
      return meta;
    }
  } catch {
    /* fall through to local cache */
  }
  return loadTemplateVariableMeta(templateName);
}

export function getTemplateButtons(template?: {
  buttons?: TemplateButton[];
  components?: Array<{ type: string; buttons?: TemplateButton[] }>;
}): TemplateButton[] {
  if (!template) return [];
  if (template.buttons?.length) return template.buttons;
  return template.components?.find((c) => (c.type || '').toUpperCase() === 'BUTTONS')?.buttons || [];
}

export function templateNeedsCoupon(template?: Parameters<typeof getTemplateButtons>[0]): boolean {
  return getTemplateButtons(template).some((b) => (b.type || '').toUpperCase() === 'COPY_CODE');
}

export function templateDynamicUrlButtons(template?: Parameters<typeof getTemplateButtons>[0]): TemplateButton[] {
  return getTemplateButtons(template).filter(
    (b) => (b.type || '').toUpperCase() === 'URL' && /\{\{\s*\d+\s*\}\}/.test(b.url || ''),
  );
}

/** Show coupon / URL suffix on the WhatsApp preview without changing send params. */
export function applySendExtrasToButtons(
  buttons: TemplateButton[],
  extras?: { couponCode?: string; buttonUrlSuffixes?: string[] },
): TemplateButton[] {
  if (!extras) return buttons;
  let suffixIndex = 0;
  return buttons.map((button) => {
    const type = (button.type || '').toUpperCase();
    if (type === 'COPY_CODE' && extras.couponCode?.trim()) {
      return { ...button, text: extras.couponCode.trim() };
    }
    if (type === 'URL' && /\{\{\s*\d+\s*\}\}/.test(button.url || '')) {
      const suffix = extras.buttonUrlSuffixes?.[suffixIndex]?.trim() || '';
      suffixIndex += 1;
      if (suffix && button.url) {
        return { ...button, url: button.url.replace(/\{\{\s*\d+\s*\}\}/, suffix) };
      }
    }
    return button;
  });
}

export function humanizeParamValue(value: string): string {
  const source = sourceFromParamValue(value);
  if (source) return `Auto: ${sourceLabel(source, customKeyFromParamValue(value))}`;
  return value;
}

export function variableDescription(
  meta: TemplateVariableMeta[],
  scope: 'body' | 'header',
  index0: number,
  fallback: string,
): string {
  const hit = meta.find((m) => m.scope === scope && m.index === index0 + 1);
  const description = hit?.description?.trim();
  return description || fallback;
}

/** Human label for a mapped source, e.g. "customer name". */
export function sourceLabel(source?: string, customKey?: string): string {
  if (source === 'contact.name') return 'customer name';
  if (source === 'contact.phone') return 'phone number';
  if (source === 'contact.email') return 'email';
  if (source === 'contact.custom') return customKey || 'custom field';
  return '';
}

/** Campaign / test-send dropdown: map a variable to a contact field or static text. */
export type CampaignParamSource = 'contact.name' | 'contact.phone' | 'contact.email' | 'custom';

export const CAMPAIGN_PARAM_SOURCE_OPTIONS: Array<{ value: CampaignParamSource; label: string }> = [
  { value: 'contact.name', label: "Each person's name" },
  { value: 'contact.phone', label: "Each person's phone" },
  { value: 'contact.email', label: "Each person's email" },
  { value: 'custom', label: 'Same text for everyone' },
];

export function campaignParamSelectValue(value: string): CampaignParamSource {
  const source = sourceFromParamValue(value);
  if (source === 'contact.name' || source === 'contact.phone' || source === 'contact.email') {
    return source;
  }
  return 'custom';
}

export function campaignParamMappedHint(source: CampaignParamSource): string | null {
  if (source === 'contact.name') return 'Each recipient sees their own name.';
  if (source === 'contact.phone') return 'Each recipient sees their own phone number.';
  if (source === 'contact.email') return 'Each recipient sees their own email.';
  return null;
}

export function paramsIncludeMappedContact(params: string[]): boolean {
  return params.some((value) => campaignParamSelectValue(value) !== 'custom');
}

/** Store {{name}} / {{phone}} / {{email}}, or clear a token when switching to static text. */
export function valueForCampaignParamSource(source: CampaignParamSource, previousValue: string): string {
  if (source === 'custom') {
    return campaignParamSelectValue(previousValue) === 'custom' ? previousValue : '';
  }
  return CONTACT_SOURCE_TOKEN[source];
}

/** Contact snapshot for inbox template variable pickers. */
export interface ContactParamPreview {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  customAttributes?: Record<string, string>;
}

function inboxOptionLabel(label: string, value?: string | null): string {
  const live = value?.trim();
  if (live) {
    const preview = live.length > 36 ? `${live.slice(0, 35)}…` : live;
    return `${label} · ${preview}`;
  }
  return `${label} · empty`;
}

function humanizeCustomKey(key: string): string {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

/** Inbox composer: contact fields + custom attributes + free text. */
export function buildInboxParamSourceOptions(
  contact?: ContactParamPreview,
): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [
    { value: 'contact.name', label: inboxOptionLabel('Customer name', contact?.name) },
    { value: 'contact.phone', label: inboxOptionLabel('Phone number', contact?.phone) },
    { value: 'contact.email', label: inboxOptionLabel('Email', contact?.email) },
  ];

  const attrs = contact?.customAttributes;
  if (attrs) {
    for (const [key, raw] of Object.entries(attrs)) {
      const normalized = normalizeCustomKey(key);
      if (!normalized) continue;
      options.push({
        value: `contact.custom.${normalized}`,
        label: inboxOptionLabel(humanizeCustomKey(normalized), raw),
      });
    }
  }

  options.push({ value: 'custom', label: 'Custom value…' });
  return options;
}

export function inboxParamSelectValue(value: string): string {
  const source = sourceFromParamValue(value);
  if (source === 'contact.name' || source === 'contact.phone' || source === 'contact.email') {
    return source;
  }
  if (source === 'contact.custom') {
    const key = customKeyFromParamValue(value);
    return key ? `contact.custom.${key}` : 'custom';
  }
  return 'custom';
}

export function inboxParamMappedHint(source: string, contact?: ContactParamPreview): string | null {
  if (source === 'custom') return null;
  if (source === 'contact.name') {
    const name = contact?.name?.trim();
    return name
      ? `Uses ${name} from this contact.`
      : 'Uses customer name · sent as “Valued customer” if empty.';
  }
  if (source === 'contact.phone') {
    const phone = contact?.phone?.trim();
    return phone ? `Uses ${phone} from this contact.` : 'Uses phone number from this contact.';
  }
  if (source === 'contact.email') {
    const email = contact?.email?.trim();
    return email
      ? `Uses ${email} from this contact.`
      : 'Uses email · sent as “your registered email” if empty.';
  }
  if (source.startsWith('contact.custom.')) {
    const key = source.slice('contact.custom.'.length);
    const live = key ? contact?.customAttributes?.[key]?.trim() : '';
    const label = humanizeCustomKey(key);
    return live ? `Uses ${live} (${label}).` : `Uses ${label} from this contact · “-” if empty.`;
  }
  return null;
}

/** Store {{name}}/{{phone}}/{{email}}/{{customKey}} or keep typed text for Custom value. */
export function valueForInboxParamSource(source: string, previousValue: string): string {
  if (source === 'custom') {
    return inboxParamSelectValue(previousValue) === 'custom' ? previousValue : '';
  }
  if (source.startsWith('contact.custom.')) {
    const key = source.slice('contact.custom.'.length);
    return tokenForSource('contact.custom', key);
  }
  if (source === 'contact.name' || source === 'contact.phone' || source === 'contact.email') {
    return CONTACT_SOURCE_TOKEN[source];
  }
  return previousValue;
}

export function upsertVariableMetaFromParam(
  meta: TemplateVariableMeta[],
  scope: 'body' | 'header',
  index0: number,
  value: string,
  description: string,
): TemplateVariableMeta[] {
  const index = index0 + 1;
  const suggestedSource = campaignParamSelectValue(value);
  const next = meta.filter((item) => !(item.scope === scope && item.index === index));
  next.push({
    scope,
    index,
    description,
    suggestedSource,
  });
  return next.sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === 'header' ? -1 : 1;
    return a.index - b.index;
  });
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
export function previewParams(
  params: string[],
  contact?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    customAttributes?: Record<string, string> | null;
  },
): string[] {
  return params.map((value) => {
    const source = sourceFromParamValue(value);
    if (source === 'contact.name' && contact?.name?.trim()) return contact.name.trim();
    if (source === 'contact.phone' && contact?.phone?.trim()) return contact.phone.trim();
    if (source === 'contact.email' && contact?.email?.trim()) return contact.email.trim();
    if (source === 'contact.custom') {
      const key = customKeyFromParamValue(value);
      const live = key ? contact?.customAttributes?.[key]?.trim() : '';
      if (live) return live;
    }
    return previewValueForParam(value);
  });
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
      customKey: prev?.customKey,
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
      customKey: prev?.customKey,
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
  buttons?: TemplateButtonForm[];
  /** description per body var index (1-based) → auto-mapped source */
  variables: Array<{
    description: string;
    source: TemplateVariableMeta['suggestedSource'];
    customKey?: string;
  }>;
}

/** Three starters shown on Create. OTP / auth lives in Meta’s library (special AUTH payload). */
export const TEMPLATE_PURPOSE_PRESETS: TemplatePurposePreset[] = [
  {
    id: 'order_update',
    label: 'Order update',
    hint: 'Confirm or ship an order',
    category: 'UTILITY',
    body: 'Hi {{1}}, your order {{2}} has been confirmed. We will notify you once it ships.',
    variables: [
      { description: 'Customer name', source: 'contact.name' },
      { description: 'Order number', source: 'contact.custom', customKey: 'order_id' },
    ],
  },
  {
    id: 'appointment_reminder',
    label: 'Appointment reminder',
    hint: 'Remind about a booking',
    category: 'UTILITY',
    body: 'Hi {{1}}, this is a reminder for your appointment on {{2}}. Reply to reschedule.',
    variables: [
      { description: 'Customer name', source: 'contact.name' },
      { description: 'Date or time', source: 'custom' },
    ],
  },
  {
    id: 'offer_code',
    label: 'Offer / promo',
    hint: 'Discount for opted-in customers',
    category: 'MARKETING',
    body: 'Hi {{1}}, here is your exclusive offer. Use code {{2}} at checkout.',
    footer: 'Reply STOP to unsubscribe',
    buttons: [
      {
        type: 'COPY_CODE',
        text: 'Copy code',
        url: '',
        phone_number: '',
        example: 'SAVE20',
      },
    ],
    variables: [
      { description: 'Customer name', source: 'contact.name' },
      { description: 'Offer code', source: 'custom' },
    ],
  },
];

const PRESET_NAME_IDS = new Set(TEMPLATE_PURPOSE_PRESETS.map((preset) => preset.id));

export function sampleForVariable(
  description: string,
  index: number,
  source?: TemplateVariableMeta['suggestedSource'],
): string {
  if (AUTO_FILL_SAMPLES[description]?.[0]) return AUTO_FILL_SAMPLES[description][0];
  if (description === 'Customer name' || source === 'contact.name') return 'Rahul';
  if (source === 'contact.phone') return '+919876543210';
  if (source === 'contact.email') return 'rahul@example.com';
  if (source === 'contact.custom') return 'order_id';
  return `Sample ${index}`;
}

export function applyPurposePreset(form: TemplateFormState, preset: TemplatePurposePreset): TemplateFormState {
  const variableMeta: TemplateVariableMeta[] = preset.variables.map((v, i) => ({
    scope: 'body' as const,
    index: i + 1,
    description: v.description,
    suggestedSource: v.source,
    ...(v.customKey ? { customKey: v.customKey } : {}),
  }));
  const keepName = form.name.trim() && !PRESET_NAME_IDS.has(form.name);
  const next = syncFormExamples({
    ...form,
    name: keepName ? form.name : preset.id,
    category: preset.category,
    body: preset.body,
    header: '',
    headerFormat: 'NONE',
    headerMediaHandle: '',
    footer: preset.footer ?? '',
    buttons: preset.buttons ? preset.buttons.map((button) => ({ ...button })) : [],
    variableMeta,
    addSecurityRecommendation: preset.category === 'AUTHENTICATION',
    authType: 'OTP',
  });
  return {
    ...next,
    bodyExamples: next.bodyExamples.map((value, index) => {
      if (value.trim()) return value;
      return sampleForVariable(preset.variables[index]?.description || '', index + 1);
    }),
  };
}

export const AUTO_FILL_SAMPLES: Record<string, string[]> = {
  'Customer name': ['Rahul', 'Priya', 'Amit'],
  'Order number': ['ORD12345', 'ORD98765', 'ORD55443'],
  'Date or time': ['12 Aug 2026', 'Tomorrow 3 PM', 'Friday 10 AM'],
  Amount: ['₹1,299', '₹499', '₹2,450'],
  'Reference ID': ['REF-8821', 'TRK-4412', 'ID-99001'],
  'Verification code': ['482910', '739201', '105482'],
  'Offer code': ['SAVE20', 'WELCOME10', 'FLAT100'],
  'Product name': ['Premium Plan', 'Blue Sneakers', 'Annual subscription'],
  Location: ['Mumbai', 'Delhi', 'Bangalore'],
};
