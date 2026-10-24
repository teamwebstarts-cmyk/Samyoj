import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  CheckCircle2,
  CreditCard,
  FileText,
  Gift,
  KeyRound,
  MapPin,
  MessageSquare,
  Package,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
  UserRound,
} from 'lucide-react';

export type LibraryRow = {
  id: string;
  slug: string;
  title: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION' | string;
  tags: string[];
  icon: string;
  header: string | null;
  mediaFormat?: '' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null;
  body: string;
  bodyHi: string;
  footer: string | null;
  footerHi: string | null;
  buttons: Array<{ type: string; text: string; url?: string; phone_number?: string; example?: string }>;
  bodyExamples: string[] | unknown;
  copy: string;
  published: boolean;
  sortOrder: number;
  updatedAt?: string | null;
  language?: string;
};

/** Same button model as the client wizard (client/src/utils/templateForm.ts). */
export type TemplateButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';
const BUTTON_TYPES: readonly TemplateButtonType[] = ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE'];

export type TemplateButtonForm = {
  type: TemplateButtonType;
  text: string;
  url: string;
  phone_number: string;
  example: string;
};

export function emptyTemplateButton(type: TemplateButtonType = 'QUICK_REPLY'): TemplateButtonForm {
  return { type, text: '', url: '', phone_number: '', example: '' };
}

/** Same source options as client TemplateVariableConnect. */
export const VARIABLE_SOURCE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Type when sending' },
  { value: 'contact.name', label: 'Customer name' },
  { value: 'contact.phone', label: 'Phone number' },
  { value: 'contact.email', label: 'Email' },
  { value: 'contact.custom', label: 'Contact custom field' },
  { value: 'custom', label: 'Same value for everyone' },
];

const AUTO_FILL_SAMPLES: Record<string, string> = {
  'Customer name': 'Rahul',
  'Order number': 'ORD12345',
  'Date or time': '12 Aug 2026',
  Amount: '₹1,299',
  'Reference ID': 'REF-8821',
  'Verification code': '482910',
  'Offer code': 'SAVE20',
  'Product name': 'Premium Plan',
  Location: 'Mumbai',
};

/** Same fallbacks as client sampleForVariable (first preset / source-aware / positional). */
export function sampleForVariable(description: string, index: number, source?: string): string {
  if (AUTO_FILL_SAMPLES[description]) return AUTO_FILL_SAMPLES[description];
  if (description === 'Customer name' || source === 'contact.name') return 'Rahul';
  if (source === 'contact.phone') return '+919876543210';
  if (source === 'contact.email') return 'rahul@example.com';
  if (source === 'contact.custom') return 'order_id';
  return `Sample ${index}`;
}

export type Draft = {
  slug: string;
  title: string;
  /** Free-form category (builtin or custom). Custom values stay platform-only. */
  category: string;
  language: string;
  tags: string;
  icon: string;
  header: string;
  mediaFormat: '' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  body: string;
  bodyHi: string;
  footer: string;
  footerHi: string;
  buttons: TemplateButtonForm[];
  /** Editor-local only — variable descriptions/mapping are not part of the catalog row (client parity). */
  variableMeta: Array<{ scope: 'body' | 'header'; index: number; description: string; suggestedSource: string; customKey: string }>;
  headerExamples: string[];
  bodyExamples: string[];
  copy: string;
  published: boolean;
  sortOrder: string;
};

export const EMPTY_DRAFT: Draft = {
  slug: '',
  title: '',
  category: 'UTILITY',
  language: 'en_US',
  tags: '',
  icon: 'file',
  header: '',
  mediaFormat: '',
  body: '',
  bodyHi: '',
  footer: '',
  footerHi: '',
  buttons: [],
  variableMeta: [],
  headerExamples: [],
  bodyExamples: [],
  copy: '',
  published: false,
  sortOrder: '0',
};

export const HONESTY =
  'These drafts live in Samyoj and show in the customer Template Library when published. Submitting still sends the copy to Meta for that org’s WhatsApp number. Utility and authentication are usually faster. Marketing is slower. Samyoj cannot pre-approve Meta on a customer number.';

export function rowToDraft(row: LibraryRow): Draft {
  const buttons: TemplateButtonForm[] = (row.buttons || [])
    .filter((button): button is typeof button & { type: TemplateButtonType } =>
      BUTTON_TYPES.includes(button.type as TemplateButtonType)
    )
    .map((button) => ({
      type: button.type,
      text: button.text || '',
      url: button.url || '',
      phone_number: button.phone_number || '',
      example: button.example || '',
    }));
  const examples = Array.isArray(row.bodyExamples)
    ? row.bodyExamples.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    slug: row.slug,
    title: row.title,
    // Keep custom categories as-is; only blank/garbage falls back to UTILITY.
    category: row.category?.trim() ? row.category : 'UTILITY',
    language: row.language || 'en_US',
    tags: (row.tags || []).join(', '),
    icon: row.icon || 'file',
    header: row.header || '',
    mediaFormat: row.mediaFormat || '',
    body: row.body,
    bodyHi: row.bodyHi,
    footer: row.footer || '',
    footerHi: row.footerHi || '',
    buttons,
    variableMeta: [],
    headerExamples: [],
    bodyExamples: examples,
    copy: row.copy || '',
    published: row.published,
    sortOrder: String(row.sortOrder ?? 0),
  };
}

export function draftPayload(draft: Draft) {
  const tags = draft.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const bodyExamples = draft.bodyExamples.map((item) => item.trim()).filter(Boolean);
  const buttons: LibraryRow['buttons'] = draft.buttons
    .filter((button) => button.text.trim())
    .map((button) => ({
      type: button.type,
      text: button.text.trim(),
      ...(button.type === 'URL' && button.url.trim() ? { url: button.url.trim() } : {}),
      ...(button.type === 'PHONE_NUMBER' && button.phone_number.trim()
        ? { phone_number: button.phone_number.trim() }
        : {}),
      ...(button.type === 'COPY_CODE' && button.example.trim() ? { example: button.example.trim() } : {}),
    }));
  return {
    slug: draft.slug.trim(),
    title: draft.title.trim(),
    category: draft.category,
    tags,
    icon: draft.icon.trim() || 'file',
    header: draft.header.trim() || null,
    mediaFormat: draft.mediaFormat || null,
    body: draft.body,
    bodyHi: draft.bodyHi,
    footer: draft.footer.trim() || null,
    footerHi: draft.footerHi.trim() || null,
    buttons,
    bodyExamples,
    copy: draft.copy.trim(),
    published: draft.published,
    sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
  };
}

export const LANGUAGES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'en_US', label: 'English (US)' },
  { value: 'hi_IN', label: 'Hindi' },
];

export function languageLabel(code?: string | null): string {
  if (!code) return 'English (US)';
  return LANGUAGES.find((option) => option.value === code)?.label ?? code;
}

/** FESTIVE_OFFER → Festive Offer (custom-category filter/badge labels). */
export function titleCaseCategory(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Same icon keys the customer-facing CatalogLibraryCard maps (client/src/components/templates/library). */
export const ICON_MAP: Record<string, LucideIcon> = {
  package: Package,
  truck: Truck,
  pin: MapPin,
  calendar: Calendar,
  card: CreditCard,
  user: UserRound,
  shield: ShieldCheck,
  key: KeyRound,
  store: Store,
  sparkles: Sparkles,
  cart: ShoppingCart,
  gift: Gift,
  check: CheckCircle2,
  message: MessageSquare,
};

/** Same category gradients as the customer template cards (templateUi.tsx). */
export const CATEGORY_AVATAR: Record<string, string> = {
  UTILITY: 'bg-gradient-to-br from-sky-500 to-blue-600',
  MARKETING: 'bg-gradient-to-br from-rose-500 to-pink-600',
  AUTHENTICATION: 'bg-gradient-to-br from-violet-600 to-indigo-700',
};

export function iconFor(row: Pick<LibraryRow, 'icon' | 'category'>): LucideIcon {
  if (row.icon && ICON_MAP[row.icon]) return ICON_MAP[row.icon];
  if (row.category === 'AUTHENTICATION') return KeyRound;
  if (row.category === 'MARKETING') return Sparkles;
  return FileText;
}

/** Highest {{n}} placeholder index across both language bodies. */
export function templateVariableCount(body: string, bodyHi: string): number {
  let max = 0;
  for (const text of [body, bodyHi]) {
    for (const match of text.matchAll(/\{\{(\d+)\}\}/g)) {
      max = Math.max(max, Number.parseInt(match[1], 10) || 0);
    }
  }
  return max;
}

/** Distinct {{n}} indexes present in one body text, ascending (chip roster). */
export function bodyVariableIndexes(text: string): number[] {
  const set = new Set<number>();
  for (const match of text.matchAll(/\{\{(\d+)\}\}/g)) {
    set.add(Number.parseInt(match[1], 10) || 0);
  }
  set.delete(0);
  return [...set].sort((a, b) => a - b);
}
