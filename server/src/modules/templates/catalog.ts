export const CATALOG_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'UTILITY', label: 'Utility' },
  { id: 'AUTHENTICATION', label: 'OTP' },
  { id: 'welcome', label: 'Hello' },
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

/**
 * Tenant library no longer publishes Samyoj-authored drafts (the old 30+ pack
 * plus the 5 custom hellos). Those rows stay in Postgres unpublished so we
 * never delete a customer’s Meta WABA templates. Live cards come from
 * meta-library-pack.ts (Meta Template Library + hello_world).
 */
export const SAMYOJ_CATALOG: SamyojCatalogEntry[] = [];

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
