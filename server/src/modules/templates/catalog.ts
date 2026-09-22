export const CATALOG_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'UTILITY', label: 'Utility' },
  { id: 'MARKETING', label: 'Marketing' },
  { id: 'welcome', label: 'Hello' },
  { id: 'events', label: 'Events' },
] as const;

export type CatalogFilterId = (typeof CATALOG_FILTERS)[number]['id'];

export type CatalogButton = {
  type: 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'QUICK_REPLY';
  text: string;
  url?: string;
  phone_number?: string;
  example?: string;
};

export type SamyojCatalogEntry = {
  id: string;
  title: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  tags: string[];
  icon: string;
  header?: string;
  mediaFormat?: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  body: string;
  bodyHi: string;
  footer?: string;
  footerHi?: string;
  buttons?: CatalogButton[];
  bodyExamples: string[];
  copy: string;
};

const MARKETING_FOOTER = 'Reply STOP to unsubscribe';
const MARKETING_FOOTER_HI = 'Unsubscribe ke liye STOP likhein';
const SAMPLE_URL = 'https://www.yourbrand.com/';

/** Curated Samyoj library — five compliant starters only (not Meta’s pre-approved library). */
export const SAMYOJ_CATALOG: SamyojCatalogEntry[] = [
  {
    id: 'hello_reply',
    title: 'Hello — we got your message',
    category: 'UTILITY',
    tags: ['UTILITY', 'welcome'],
    icon: 'message',
    header: 'Thanks for reaching out',
    body:
      'Hi {{1}}, thanks for messaging {{2}}. Our team will reply soon. Share any details we should know here.',
    bodyHi:
      'Namaste {{1}}, {{2}} ko message karne ke liye dhanyavaad. Hamari team jaldi jawab degi. Zaroori details yahan likh sakte hain.',
    bodyExamples: ['Rahul', 'Acme Store'],
    copy: 'Service hello after a customer messages you (utility, not a promo blast).',
  },
  {
    id: 'hello_welcome',
    title: 'Hello — welcome',
    category: 'UTILITY',
    tags: ['UTILITY', 'welcome'],
    icon: 'user',
    header: 'Welcome',
    body: 'Hi {{1}}, welcome to {{2}}. How can we help you today?',
    bodyHi: 'Namaste {{1}}, {{2}} mein aapka swagat hai. Aaj hum kaise madad kar sakte hain?',
    buttons: [{ type: 'URL', text: 'Visit website', url: SAMPLE_URL }],
    bodyExamples: ['Rahul', 'Acme Store'],
    copy: 'Simple welcome when someone new contacts your business.',
  },
  {
    id: 'party_invitation',
    title: 'Party or celebration invite',
    category: 'MARKETING',
    tags: ['MARKETING', 'events'],
    icon: 'megaphone',
    header: 'You are invited',
    body:
      'Hi {{1}}, you are invited to {{2}} on {{3}} at {{4}}. Reply YES or NO to RSVP.',
    bodyHi:
      'Namaste {{1}}, aap {{3}} ko {{4}} baje {{2}} par invite hain. RSVP ke liye YES ya NO likhein.',
    footer: MARKETING_FOOTER,
    footerHi: MARKETING_FOOTER_HI,
    buttons: [
      { type: 'QUICK_REPLY', text: 'YES' },
      { type: 'QUICK_REPLY', text: 'NO' },
    ],
    bodyExamples: ['Rahul', 'our annual celebration', 'Saturday 7 Dec', '6:00 PM'],
    copy: 'Event or party invite — use only with opted-in contacts.',
  },
  {
    id: 'marketing_update',
    title: 'Business update (marketing)',
    category: 'MARKETING',
    tags: ['MARKETING', 'offers'],
    icon: 'sparkles',
    header: 'News from us',
    body:
      'Hi {{1}}, a quick update from {{2}}: {{3}}. Promotional messages only for subscribers.',
    bodyHi:
      'Namaste {{1}}, {{2}} ka update: {{3}}. Yeh message sirf subscribers ke liye hai.',
    footer: MARKETING_FOOTER,
    footerHi: MARKETING_FOOTER_HI,
    buttons: [{ type: 'QUICK_REPLY', text: 'Learn more' }],
    bodyExamples: ['Rahul', 'Acme Store', 'weekend hours start Friday'],
    copy: 'Light marketing announcement with opt-out footer — not for cold lists.',
  },
  {
    id: 'modern_status',
    title: 'Modern status update',
    category: 'UTILITY',
    tags: ['UTILITY', 'saas'],
    icon: 'sparkles',
    header: 'Quick update',
    body: 'Hi {{1}}, your request {{2}} is now {{3}}. Reply if anything looks wrong.',
    bodyHi:
      'Namaste {{1}}, aapki request {{2}} ab {{3}} hai. Kuch galat lage to reply karein.',
    buttons: [{ type: 'URL', text: 'View details', url: SAMPLE_URL }],
    bodyExamples: ['Rahul', 'REQ-1024', 'in progress'],
    copy: 'Clean transactional status line (utility).',
  },
];

function localized(entry: SamyojCatalogEntry, language: string) {
  const hindi = language === 'hi' || language === 'hi_IN';
  return {
    body: hindi ? entry.bodyHi : entry.body,
    footer: hindi ? entry.footerHi || entry.footer : entry.footer,
  };
}

export function starterCreatePayload(
  starter: SamyojCatalogEntry,
  language: string,
  name: string,
  buttonOverrides?: { url?: string; phone?: string }
) {
  const { body, footer } = localized(starter, language);
  const url = buttonOverrides?.url?.trim();
  const phone = buttonOverrides?.phone?.trim();
  const allowed = new Set(['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE']);
  const buttons = (starter.buttons || [])
    .filter((btn) => allowed.has(btn.type))
    .map((btn) => {
      if (btn.type === 'URL') {
        if (!url) return { type: 'QUICK_REPLY' as const, text: btn.text };
        return {
          ...btn,
          url,
          ...( /\{\{\d+\}\}/.test(url) ? { example: btn.example || 'order-123' } : {}),
        };
      }
      if (btn.type === 'PHONE_NUMBER') return { ...btn, phone_number: phone || btn.phone_number };
      return btn;
    });
  return {
    name,
    language: language === 'hi' ? 'hi_IN' : language,
    category: starter.category,
    headerFormat: starter.header ? ('TEXT' as const) : ('NONE' as const),
    header: starter.header,
    body,
    footer,
    bodyExamples: starter.bodyExamples,
    buttons: buttons.length ? buttons : undefined,
    ...(starter.category === 'AUTHENTICATION'
      ? { authType: 'OTP' as const, addSecurityRecommendation: true }
      : {}),
  };
}

export function listSamyojStarters() {
  return SAMYOJ_CATALOG.map((starter) => ({
    ...starter,
    languages: ['en_US', 'hi_IN'] as const,
    submitMode: 'create' as const,
  }));
}

export function matchCatalogFilter(entry: SamyojCatalogEntry, filterId: string): boolean {
  if (!filterId || filterId === 'all') return true;
  if (filterId === entry.category) return true;
  return entry.tags.includes(filterId);
}
