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
    return { ...meta, description, suggestedSource: source };
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
