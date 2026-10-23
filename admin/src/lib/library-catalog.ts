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
  /** Mock-only (design work). Real catalog rows are en+hi bilingual; drop with the mock data. */
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
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
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
  published: true,
  sortOrder: '0',
};

export const HONESTY =
  'These drafts live in Samyoj and show in the customer Template Library when published. Submitting still sends the copy to Meta for that org’s WhatsApp number. Utility and authentication are usually faster. Marketing is slower. Samyoj cannot pre-approve Meta on a customer number.';

/**
 * ponytail: Mock rows for catalog design work — the dev DB is empty and the API
 * has no language field yet. Delete USE_MOCK_CATALOG + the mock store below once
 * the real data ships, and flip both pages back to platformRequest only.
 */
export const USE_MOCK_CATALOG = true;

const ago = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

let mockRows: LibraryRow[] = [
  {
    id: 'mock-1', slug: 'special_sale_offer', title: 'Special Sale Offer', category: 'MARKETING',
    tags: ['sale'], icon: 'sparkles', header: null, mediaFormat: null,
    body: 'Hi {{1}}, our biggest sale of the season is live! Flat {{2}} off on everything you love.',
    bodyHi: '{{1}}, हमारा सबसे बड़ा सेल शुरू! सब कुछ {{2}} छूट पर।',
    footer: 'Team Samyoj', footerHi: 'टीम सैमयोज', buttons: [], bodyExamples: ['Ravi', '20%'],
    copy: 'Flat discount for the season sale', published: true, sortOrder: 1, updatedAt: ago(2), language: 'en_US',
  },
  {
    id: 'mock-2', slug: 'diwali_greetings', title: 'Diwali Greetings', category: 'MARKETING',
    tags: ['festival'], icon: 'gift', header: null, mediaFormat: null,
    body: 'Shine bright this Diwali! {{1}} wishes you and your family a festival full of light and joy.',
    bodyHi: 'इस दिवाली आपको और आपके परिवार को ढेर सारी शुभकामनाएँ!',
    footer: 'Team Samyoj', footerHi: 'टीम सैमयोज', buttons: [], bodyExamples: ['Samyoj'],
    copy: 'Festive wishes blast', published: true, sortOrder: 2, updatedAt: ago(5), language: 'hi_IN',
  },
  {
    id: 'mock-3', slug: 'order_confirmed', title: 'Order Confirmed', category: 'UTILITY',
    tags: ['orders'], icon: 'package', header: null, mediaFormat: null,
    body: 'Hi {{1}}, your order {{2}} is confirmed! We will notify you when it ships.',
    bodyHi: '{{1}}, आपका ऑर्डर {{2}} कन्फर्म हो गया है!',
    footer: 'Track your order', footerHi: 'ऑर्डर ट्रैक करें', buttons: [], bodyExamples: ['Ravi', '10234'],
    copy: 'Order confirmation template', published: true, sortOrder: 3, updatedAt: ago(7), language: 'en_US',
  },
  {
    id: 'mock-4', slug: 'payment_reminder', title: 'Payment Reminder', category: 'UTILITY',
    tags: ['payments'], icon: 'card', header: null, mediaFormat: null,
    body: 'Namaste {{1}}, a gentle reminder: your payment of {{2}} is due on {{3}}.',
    bodyHi: '{{1}}, आपका भुगतान {{2}} {{3}} तक देय है।',
    footer: 'Payments', footerHi: 'भुगतान', buttons: [], bodyExamples: ['Ravi', 'Rs 1200', '5 Nov'],
    copy: 'Due-date payment reminder', published: true, sortOrder: 4, updatedAt: ago(14), language: 'en_US',
  },
  {
    id: 'mock-5', slug: 'new_product_launch', title: 'New Product Launch', category: 'MARKETING',
    tags: ['launch'], icon: 'store', header: null, mediaFormat: null,
    body: 'The wait is over! Meet our all-new {{1}} — now available at an early-bird price.',
    bodyHi: 'नया {{1}} अब उपलब्ध है! पहले 100 ग्राहकों के लिए स्पेशल कीमत।',
    footer: 'Shop now', footerHi: 'अभी खरीदें', buttons: [], bodyExamples: ['Smart Kettle'],
    copy: 'Launch announcement', published: false, sortOrder: 5, updatedAt: ago(20), language: 'en_US',
  },
  {
    id: 'mock-6', slug: 'otp_login_code', title: 'OTP Login Code', category: 'AUTHENTICATION',
    tags: ['otp'], icon: 'key', header: null, mediaFormat: null,
    body: '{{1}} is your verification code. For your security, do not share this code.',
    bodyHi: '{{1}} आपका वेरिफिकेशन कोड है। इसे किसी के साथ साझा न करें।',
    footer: null, footerHi: null, buttons: [], bodyExamples: ['482913'],
    copy: 'Login OTP code', published: true, sortOrder: 6, updatedAt: ago(1), language: 'en_US',
  },
];

export function listMockRows(): LibraryRow[] {
  return mockRows;
}

export function findMockRow(id: string): LibraryRow | undefined {
  return mockRows.find((row) => row.id === id);
}

export function upsertMockRow(row: LibraryRow): LibraryRow {
  const next = { ...row, updatedAt: new Date().toISOString() };
  mockRows = mockRows.some((existing) => existing.id === row.id)
    ? mockRows.map((existing) => (existing.id === row.id ? next : existing))
    : [...mockRows, next];
  return next;
}

export function deleteMockRow(id: string): void {
  mockRows = mockRows.filter((row) => row.id !== id);
}

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
    category:
      row.category === 'MARKETING' || row.category === 'AUTHENTICATION' ? row.category : 'UTILITY',
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
