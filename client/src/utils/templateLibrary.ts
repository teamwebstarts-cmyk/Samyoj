import type { TemplateButton, TemplateLibraryEntry, MessageTemplate } from '../types';
import {
  formFromLibraryEntry,
  formFromMessageTemplate,
  inferVariableDescription,
  syncFormExamples,
  type TemplateFormState,
  type TemplateVariableMeta,
} from './templateForm';

/**
 * Official Meta Template Library filters (Cloud API, May 2026).
 * https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/template-library/
 *
 * Meta's library is Utility + Authentication only. Marketing is never returned.
 * Industry/topic/usecase values other than these enums make Graph return empty.
 */
export const LIBRARY_INDUSTRIES = [
  { value: '', label: 'All industries' },
  { value: 'E_COMMERCE', label: 'E-commerce' },
  { value: 'FINANCIAL_SERVICES', label: 'Financial services' },
] as const;

export const LIBRARY_TOPICS = [
  { value: '', label: 'All topics' },
  { value: 'ACCOUNT_UPDATE', label: 'Account update' },
  { value: 'CUSTOMER_FEEDBACK', label: 'Customer feedback' },
  { value: 'ORDER_MANAGEMENT', label: 'Order management' },
  { value: 'PAYMENTS', label: 'Payments' },
] as const;

export const LIBRARY_USECASES = [
  { value: '', label: 'All use cases' },
  { value: 'ACCOUNT_CREATION_CONFIRMATION', label: 'Account creation confirmation' },
  { value: 'AUTO_PAY_REMINDER', label: 'Auto-pay reminder' },
  { value: 'DELIVERY_CONFIRMATION', label: 'Delivery confirmation' },
  { value: 'DELIVERY_FAILED', label: 'Delivery failed' },
  { value: 'DELIVERY_UPDATE', label: 'Delivery update' },
  { value: 'FEEDBACK_SURVEY', label: 'Feedback survey' },
  { value: 'FRAUD_ALERT', label: 'Fraud alert' },
  { value: 'LOW_BALANCE_WARNING', label: 'Low balance warning' },
  { value: 'ORDER_ACTION_NEEDED', label: 'Order action needed' },
  { value: 'ORDER_CONFIRMATION', label: 'Order confirmation' },
  { value: 'ORDER_DELAY', label: 'Order delay' },
  { value: 'ORDER_OR_TRANSACTION_CANCEL', label: 'Order / transaction cancel' },
  { value: 'ORDER_PICK_UP', label: 'Order pick-up' },
  { value: 'PAYMENT_ACTION_REQUIRED', label: 'Payment action required' },
  { value: 'PAYMENT_CONFIRMATION', label: 'Payment confirmation' },
  { value: 'PAYMENT_DUE_REMINDER', label: 'Payment due reminder' },
  { value: 'PAYMENT_OVERDUE', label: 'Payment overdue' },
  { value: 'PAYMENT_REJECT_FAIL', label: 'Payment rejected / failed' },
  { value: 'PAYMENT_SCHEDULED', label: 'Payment scheduled' },
  { value: 'RECEIPT_ATTACHMENT', label: 'Receipt attachment' },
  { value: 'RETURN_CONFIRMATION', label: 'Return confirmation' },
  { value: 'SHIPMENT_CONFIRMATION', label: 'Shipment confirmation' },
  { value: 'STATEMENT_ATTACHMENT', label: 'Statement attachment' },
  { value: 'STATEMENT_AVAILABLE', label: 'Statement available' },
  { value: 'TRANSACTION_ALERT', label: 'Transaction alert' },
] as const;

export const LIBRARY_CATEGORIES = [
  { value: 'ALL', label: 'All categories' },
  { value: 'UTILITY', label: 'Utility' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
] as const;

export const libraryWizardStages = [
  { id: 'browse', label: 'Browse', description: 'Pick a proven template' },
  { id: 'review', label: 'Review', description: 'Name, buttons, variables' },
  { id: 'submit', label: 'Done', description: 'Ready to send' },
] as const;

export const LIBRARY_QUICK_PICKS: Array<{
  id: string;
  label: string;
  hint: string;
  topic?: string;
  usecase?: string;
  category?: 'UTILITY' | 'AUTHENTICATION';
}> = [
  {
    id: 'order',
    label: 'Order updates',
    hint: 'Confirm / delay / cancel',
    topic: 'ORDER_MANAGEMENT',
    usecase: 'ORDER_CONFIRMATION',
  },
  {
    id: 'shipping',
    label: 'Shipping',
    hint: 'Dispatched & tracking',
    topic: 'ORDER_MANAGEMENT',
    usecase: 'SHIPMENT_CONFIRMATION',
  },
  {
    id: 'delivery',
    label: 'Delivery',
    hint: 'Out for delivery / failed',
    topic: 'ORDER_MANAGEMENT',
    usecase: 'DELIVERY_UPDATE',
  },
  {
    id: 'payment',
    label: 'Payments',
    hint: 'Due, receipt, low balance',
    topic: 'PAYMENTS',
    usecase: 'PAYMENT_DUE_REMINDER',
  },
  {
    id: 'feedback',
    label: 'Feedback',
    hint: 'Post-order survey',
    topic: 'CUSTOMER_FEEDBACK',
    usecase: 'FEEDBACK_SURVEY',
  },
  {
    id: 'account',
    label: 'Account',
    hint: 'Signup & welcome',
    topic: 'ACCOUNT_UPDATE',
    usecase: 'ACCOUNT_CREATION_CONFIRMATION',
  },
  {
    id: 'otp',
    label: 'OTP / login',
    hint: 'Verification codes',
    category: 'AUTHENTICATION',
  },
];

export type LibrarySourceTab = 'meta' | 'account';
export type LibraryCategoryFilter = (typeof LIBRARY_CATEGORIES)[number]['value'];
export type LibraryQuickPick = (typeof LIBRARY_QUICK_PICKS)[number];

export function isLibraryQuickPickActive(
  pick: LibraryQuickPick,
  usecaseFilter: string,
  categoryFilter: string,
): boolean {
  if (pick.category) return categoryFilter === pick.category && !usecaseFilter;
  return Boolean(pick.usecase) && usecaseFilter === pick.usecase;
}

export function libraryCloneCategory(
  entry: { category?: string },
): 'UTILITY' | 'AUTHENTICATION' {
  return (entry.category || 'UTILITY').toUpperCase() === 'AUTHENTICATION'
    ? 'AUTHENTICATION'
    : 'UTILITY';
}

export function matchesLibraryCategoryFilter(
  item: { name: string; body?: string; category?: string },
  categoryFilter: LibraryCategoryFilter,
): boolean {
  if (categoryFilter === 'ALL') return true;
  const cat = (item.category || 'UTILITY').toUpperCase();
  if (cat === categoryFilter) return true;
  if (categoryFilter === 'AUTHENTICATION') {
    return /otp|authenti|verif/i.test(`${item.name} ${item.body || ''}`);
  }
  return false;
}

export function humanizeLibraryName(name: string): string {
  return name
    .replace(/_usecase$/i, '')
    .replace(/_\d+$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function labelForEnum(
  options: ReadonlyArray<{ value: string; label: string }>,
  value?: string | null,
): string {
  if (!value) return '';
  return options.find((o) => o.value === value)?.label || value.replace(/_/g, ' ').toLowerCase();
}

export function isFlowLibraryTemplate(entry: { buttons?: TemplateButton[] }): boolean {
  return (entry.buttons || []).some((b) => {
    const t = (b.type || '').toUpperCase();
    return t === 'FLOW' || t === 'FORMS';
  });
}

export function libraryNeedsButtonInputs(entry: { buttons?: TemplateButton[] }): boolean {
  return (entry.buttons || []).some((b) => {
    const t = (b.type || '').toUpperCase();
    return t === 'URL' || t === 'PHONE_NUMBER';
  });
}

export function libraryNeedsOtpButton(entry: { buttons?: TemplateButton[]; category?: string }): boolean {
  if ((entry.category || '').toUpperCase() === 'AUTHENTICATION') return true;
  return (entry.buttons || []).some((b) => (b.type || '').toUpperCase() === 'OTP');
}

/**
 * Meta library clones skip content review when the body is not customized.
 * Utility and Authentication library templates can be added to the WABA via library_template_name.
 */
export function canCloneFromMetaLibrary(entry: { category?: string; source?: string }): boolean {
  if ((entry.source || 'meta') !== 'meta') return false;
  const cat = (entry.category || 'UTILITY').toUpperCase();
  return cat === 'UTILITY' || cat === 'AUTHENTICATION';
}

export function uniqueLibraryTemplateName(base: string, existing: Set<string>): string {
  const cleaned = suggestedTemplateName(base) || 'library_template';
  if (!existing.has(cleaned)) return cleaned;
  let i = 2;
  while (existing.has(`${cleaned}_${i}`)) i += 1;
  return `${cleaned}_${i}`;
}

export function normalizeLibraryParamType(paramType?: string): string {
  return (paramType || 'TEXT').toUpperCase().replace(/\s+/g, '_');
}

export function sourceFromLibraryParamType(
  paramType?: string,
): TemplateVariableMeta['suggestedSource'] {
  const t = normalizeLibraryParamType(paramType);
  if (t === 'PHONE_NUMBER' || t === 'PHONE') return 'contact.phone';
  if (t === 'EMAIL') return 'contact.email';
  if (t === 'NUMBER') return 'contact.custom';
  return 'custom';
}

export function descriptionFromLibraryParam(
  body: string,
  index: number,
  paramType?: string,
  sample?: string,
): string {
  const t = normalizeLibraryParamType(paramType);
  if (t === 'PHONE_NUMBER' || t === 'PHONE') return 'Phone number';
  if (t === 'EMAIL') return 'Email address';
  if (t === 'AMOUNT') return 'Amount';
  if (t === 'DATE') return 'Date or time';
  if (t === 'ADDRESS') return 'Location';
  if (t === 'NUMBER') return 'Reference ID';
  const inferred = inferVariableDescription(body, index);
  if (inferred === 'Customer name') return inferred;
  if (sample && /^[A-Z][a-z]+$/.test(sample.trim())) return 'Customer name';
  return inferred;
}

export function applyLibrarySamplesToForm(
  form: TemplateFormState,
  entry: TemplateLibraryEntry,
): TemplateFormState {
  const types = entry.body_param_types || [];
  const samples = entry.body_params || [];
  const variableMeta: TemplateVariableMeta[] = form.variableMeta.map((meta) => {
    if (meta.scope !== 'body') return meta;
    const paramType = types[meta.index - 1];
    const sample = samples[meta.index - 1];
    let source = sourceFromLibraryParamType(paramType);
    const description = descriptionFromLibraryParam(form.body, meta.index, paramType, sample);
    if (description === 'Customer name') source = 'contact.name';
    const customKey = source === 'contact.custom' ? (description === 'Order number' ? 'order_id' : 'reference_id') : undefined;
    return { ...meta, description, suggestedSource: source, ...(customKey ? { customKey } : {}) };
  });
  const bodyExamples = form.bodyExamples.map((val, i) => val.trim() || samples[i] || val);
  return syncFormExamples({ ...form, variableMeta, bodyExamples });
}

export function wizardFormFromLibraryItem(
  item: TemplateLibraryEntry | MessageTemplate,
  source: LibrarySourceTab,
): TemplateFormState {
  if (source === 'meta') {
    return applyLibrarySamplesToForm(formFromLibraryEntry(item as TemplateLibraryEntry), item as TemplateLibraryEntry);
  }
  return formFromMessageTemplate(item as MessageTemplate);
}

export function suggestedTemplateName(libraryName: string): string {
  return libraryName
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 512);
}

/** Upgrade http → https and add https:// when the user typed a bare domain. */
export function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  if (/^http:\/\//i.test(trimmed)) return `https://${trimmed.slice(trimmed.indexOf('://') + 3)}`;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (/^[a-z0-9.-]+[:/]/i.test(trimmed) || /^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return true;
  if (host.endsWith('.local') || host.endsWith('.localhost')) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return false;
}

/**
 * WhatsApp URL buttons must open on the customer’s phone.
 * Reject localhost / private IPs. Do not reject the same public hostname as
 * this app — a merchant may host the store and Samyoj on one domain.
 */
export function libraryButtonUrlError(raw: string, appOrigin?: string): string | null {
  const value = normalizeWebsiteUrl(raw);
  if (!value) {
    return 'Add your website link here';
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return 'That doesn’t look like a website. Paste a full web address.';
  }

  if (parsed.protocol !== 'https:') {
    return 'This website link isn’t secure enough. Use an address that starts with https://, not http://';
  }

  if (isPrivateOrLocalHost(parsed.hostname)) {
    return 'Use your live website, not this Samyoj page or a link that only works on your computer.';
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'example.com' || host.endsWith('.example.com')) {
    return 'Replace the sample address with your real website.';
  }

  if (appOrigin) {
    try {
      const here = new URL(appOrigin);
      const sameHost = parsed.hostname.toLowerCase() === here.hostname.toLowerCase();
      const crmPath = /^\/(templates|inbox|campaigns|settings|dashboard)(\/|$)/i.test(parsed.pathname);
      if (sameHost && crmPath) {
        return 'That’s this Samyoj screen, not a customer website.';
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

const LIBRARY_URL_PLACEHOLDER_RE = /\{\{\d+\}\}/;
const DEFAULT_URL_SUFFIX_EXAMPLE = 'demo';

export function libraryUrlIsDynamic(url?: string | null): boolean {
  return LIBRARY_URL_PLACEHOLDER_RE.test(url || '');
}

function firstUrlPlaceholder(url?: string | null): string {
  return url?.match(LIBRARY_URL_PLACEHOLDER_RE)?.[0] || '{{1}}';
}

function isUsableSuffixSample(segment: string): boolean {
  if (!segment || segment.length > 80) return false;
  if (LIBRARY_URL_PLACEHOLDER_RE.test(segment)) return false;
  if (/[:/?#]/.test(segment)) return false;
  return true;
}

function pathnameSegments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}

function lastPathSegment(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = pathnameSegments(parsed.pathname);
    return parts.length ? decodeURIComponent(parts[parts.length - 1]) : '';
  } catch {
    const parts = url.replace(/\/$/, '').split('/');
    return parts[parts.length - 1] || '';
  }
}

/**
 * Meta library URL buttons are often static (`https://www.example.com/`).
 * Dynamic ones include `{{1}}`. `url_suffix_example` is the {{n}} sample
 * (last path segment or a short token), not the merchant's full URL — except
 * when the library button itself is a static HTTPS link.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/template-library/
 */
export function buildLibraryUrlInput(
  userUrl: string,
  libraryUrl?: string | null,
): { base_url: string; url_suffix_example: string } {
  const user = userUrl.trim();
  const placeholder = libraryUrlIsDynamic(user)
    ? firstUrlPlaceholder(user)
    : firstUrlPlaceholder(libraryUrl);

  if (libraryUrlIsDynamic(user)) {
    const last = lastPathSegment(user);
    return {
      base_url: user,
      url_suffix_example: isUsableSuffixSample(last) ? last : DEFAULT_URL_SUFFIX_EXAMPLE,
    };
  }

  if (!libraryUrlIsDynamic(libraryUrl)) {
    return { base_url: user, url_suffix_example: user };
  }

  let origin = user.replace(/\/$/, '');
  let segments: string[] = [];
  try {
    const parsed = new URL(user);
    origin = parsed.origin;
    segments = pathnameSegments(parsed.pathname);
  } catch {
    /* keep origin from the raw string */
  }

  const last = segments[segments.length - 1] || '';
  if (last && isUsableSuffixSample(last)) {
    const prefix = segments.slice(0, -1);
    const prefixPath = prefix.length ? `/${prefix.join('/')}` : '';
    return {
      base_url: `${origin}${prefixPath}/${placeholder}`,
      url_suffix_example: last,
    };
  }

  let libraryPath = `/${placeholder}`;
  try {
    const lib = new URL(libraryUrl || '');
    const path = decodeURIComponent(lib.pathname || '');
    if (path && libraryUrlIsDynamic(path)) {
      libraryPath = path.startsWith('/') ? path : `/${path}`;
    }
  } catch {
    /* default /{{1}} */
  }

  return {
    base_url: `${origin}${libraryPath}`,
    url_suffix_example: DEFAULT_URL_SUFFIX_EXAMPLE,
  };
}

export function buildLibraryButtonInputs(
  item: { buttons?: TemplateButton[]; category?: string },
  buttonUrl: string,
  buttonPhone: string,
): Array<Record<string, unknown>> {
  const inputs: Array<Record<string, unknown>> = [];
  const url = buttonUrl.trim();
  const phone = buttonPhone.trim();

  for (const btn of item.buttons || []) {
    const type = (btn.type || '').toUpperCase();
    if (type === 'URL' && url) {
      inputs.push({
        type: 'URL',
        url: buildLibraryUrlInput(url, btn.url),
      });
    }
    if (type === 'PHONE_NUMBER' && phone) {
      inputs.push({ type: 'PHONE_NUMBER', phone_number: phone });
    }
    if (type === 'OTP') {
      inputs.push({ type: 'OTP', otp_type: 'COPY_CODE' });
    }
  }
  if (libraryNeedsOtpButton(item) && !inputs.some((input) => input.type === 'OTP')) {
    inputs.push({ type: 'OTP', otp_type: 'COPY_CODE' });
  }
  return inputs;
}
