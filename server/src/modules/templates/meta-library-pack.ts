/**
 * Tenant Template Library = Meta’s official pack, not Samyoj-authored drafts.
 *
 * - `waba_sample` (`hello_world`): Meta often puts this sample on a Cloud API
 *   number. We never invent it. If it is already APPROVED on this WABA, show
 *   Ready now. We do not DELETE WABA templates.
 * - `meta_clone`: GET /message_template_library → POST with library_template_name.
 *   Unmodified Utility/Auth clones are Meta’s fast path. Still created on THIS WABA.
 */
export const META_LIBRARY_HONESTY =
  'These are Meta’s official Template Library skeletons (Utility and Authentication) plus hello_world if Meta already added it on this number. Cloning still creates the template on YOUR WhatsApp number. Unmodified library clones are usually faster. Samyoj cannot pre-approve Meta on your number.';

export const META_LIBRARY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'UTILITY', label: 'Utility' },
  { id: 'AUTHENTICATION', label: 'OTP' },
  { id: 'welcome', label: 'Hello' },
] as const;

export type MetaLibraryPackKind = 'meta_clone' | 'waba_sample';

export type MetaLibraryPackEntry = {
  id: string;
  kind: MetaLibraryPackKind;
  title: string;
  category: 'UTILITY' | 'AUTHENTICATION';
  tags: string[];
  icon: string;
  usecase?: string;
  fallbackLibraryName?: string;
  wabaName?: string;
  body: string;
  bodyHi: string;
  copy: string;
};

export const META_LIBRARY_PACK: MetaLibraryPackEntry[] = [
  {
    id: 'hello_world',
    kind: 'waba_sample',
    title: 'Hello world',
    category: 'UTILITY',
    tags: ['UTILITY', 'welcome'],
    icon: 'message',
    wabaName: 'hello_world',
    body: 'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta.',
    bodyHi:
      'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta.',
    copy: 'Meta’s Cloud API sample. If it is already on this number, it is ready to send.',
  },
  {
    id: 'hello_account',
    kind: 'meta_clone',
    title: 'Hello — account created',
    category: 'UTILITY',
    tags: ['UTILITY', 'welcome'],
    icon: 'user',
    usecase: 'ACCOUNT_CREATION_CONFIRMATION',
    fallbackLibraryName: 'account_creation_confirmation_3',
    body: 'Hi {{1}}, your account is ready. Finish setup when you have a moment.',
    bodyHi: 'Namaste {{1}}, aapka account taiyar hai. Setup jab ready hon complete karein.',
    copy: 'Meta Template Library — hello after signup.',
  },
  {
    id: 'order_confirmation',
    kind: 'meta_clone',
    title: 'Order confirmed',
    category: 'UTILITY',
    tags: ['UTILITY', 'orders'],
    icon: 'package',
    usecase: 'ORDER_CONFIRMATION',
    fallbackLibraryName: 'order_confirmation',
    body: 'Hi {{1}}, your order {{2}} is confirmed. We will notify you when it ships.',
    bodyHi: 'Namaste {{1}}, aapka order {{2}} confirm ho gaya hai. Ship hote hi hum bataenge.',
    copy: 'Meta Template Library — order confirmation.',
  },
  {
    id: 'shipment_confirmation',
    kind: 'meta_clone',
    title: 'Order shipped',
    category: 'UTILITY',
    tags: ['UTILITY', 'shipping'],
    icon: 'truck',
    usecase: 'SHIPMENT_CONFIRMATION',
    fallbackLibraryName: 'shipment_confirmation',
    body: 'Hi {{1}}, order {{2}} is on the way. Tracking ID: {{3}}.',
    bodyHi: 'Namaste {{1}}, order {{2}} raste mein hai. Tracking ID: {{3}}.',
    copy: 'Meta Template Library — shipment update.',
  },
  {
    id: 'delivery_update',
    kind: 'meta_clone',
    title: 'Delivery update',
    category: 'UTILITY',
    tags: ['UTILITY', 'delivery'],
    icon: 'pin',
    usecase: 'DELIVERY_UPDATE',
    fallbackLibraryName: 'delivery_update_1',
    body: 'Hi {{1}}, your order {{2}} is out for delivery today.',
    bodyHi: 'Namaste {{1}}, aapka order {{2}} aaj delivery ke liye nikal chuka hai.',
    copy: 'Meta Template Library — delivery status.',
  },
  {
    id: 'payment_confirmation',
    kind: 'meta_clone',
    title: 'Payment received',
    category: 'UTILITY',
    tags: ['UTILITY', 'payments'],
    icon: 'card',
    usecase: 'PAYMENT_CONFIRMATION',
    fallbackLibraryName: 'payment_confirmation',
    body: 'Hi {{1}}, we received {{2}} for {{3}}. Thank you.',
    bodyHi: 'Namaste {{1}}, humein {{3}} ke liye {{2}} mil gaya. Dhanyavaad.',
    copy: 'Meta Template Library — payment confirmation.',
  },
  {
    id: 'otp_login',
    kind: 'meta_clone',
    title: 'Login code (OTP)',
    category: 'AUTHENTICATION',
    tags: ['AUTHENTICATION', 'otp'],
    icon: 'key',
    fallbackLibraryName: 'otp_login_1',
    body: 'Your verification code is {{1}}. Do not share it with anyone.',
    bodyHi: 'Aapka verification code {{1}} hai. Ise kisi ke saath share na karein.',
    copy: 'Meta Template Library — authentication OTP.',
  },
];

export type LibraryGraphRow = {
  name: string;
  category?: string;
  usecase?: string;
  body?: string;
  header?: string;
  footer?: string;
  buttons?: Array<{ type?: string; text?: string; url?: string; phone_number?: string }>;
  body_params?: string[];
};

export type TenantLibraryCard = {
  id: string;
  title: string;
  category: 'UTILITY' | 'AUTHENTICATION';
  tags: string[];
  icon: string;
  header?: string;
  body: string;
  bodyHi: string;
  footer?: string;
  buttons?: LibraryGraphRow['buttons'];
  bodyExamples: string[];
  copy: string;
  languages: readonly ['en_US', 'hi_IN'];
  source: 'meta' | 'ready';
  name: string;
  libraryTemplateName?: string;
  submitMode: 'clone' | 'ready';
  ready: boolean;
};

function matchCloneRow(entry: MetaLibraryPackEntry, library: LibraryGraphRow[]): LibraryGraphRow | undefined {
  if (entry.kind !== 'meta_clone') return undefined;
  if (entry.usecase) {
    const byUse = library.find((row) => (row.usecase || '').toUpperCase() === entry.usecase);
    if (byUse) return byUse;
  }
  if (entry.category === 'AUTHENTICATION') {
    const auth = library.find((row) => (row.category || '').toUpperCase() === 'AUTHENTICATION');
    if (auth) return auth;
  }
  if (entry.fallbackLibraryName) {
    const exact = library.find((row) => row.name === entry.fallbackLibraryName);
    if (exact) return exact;
    const prefix = entry.fallbackLibraryName.replace(/_\d+$/, '');
    return library.find((row) => row.name === prefix || row.name.startsWith(`${prefix}_`));
  }
  return undefined;
}

export function buildTenantLibraryCards(
  library: LibraryGraphRow[],
  approvedWabaNames: Set<string>
): TenantLibraryCard[] {
  return META_LIBRARY_PACK.map((entry) => {
    if (entry.kind === 'waba_sample') {
      const name = entry.wabaName || entry.id;
      const ready = approvedWabaNames.has(name);
      return {
        id: entry.id,
        title: entry.title,
        category: entry.category,
        tags: entry.tags,
        icon: entry.icon,
        body: entry.body,
        bodyHi: entry.bodyHi,
        bodyExamples: [],
        copy: ready
          ? 'Already on this number — send from Templates. No extra Meta review.'
          : entry.copy,
        languages: ['en_US', 'hi_IN'] as const,
        source: ready ? ('ready' as const) : ('meta' as const),
        name,
        submitMode: 'ready' as const,
        ready,
      };
    }

    const matched = matchCloneRow(entry, library);
    return {
      id: entry.id,
      title: entry.title,
      category: entry.category,
      tags: entry.tags,
      icon: entry.icon,
      header: matched?.header,
      body: matched?.body || entry.body,
      bodyHi: entry.bodyHi,
      footer: matched?.footer,
      buttons: matched?.buttons,
      bodyExamples: Array.isArray(matched?.body_params) ? matched.body_params : [],
      copy: entry.copy,
      languages: ['en_US', 'hi_IN'] as const,
      source: 'meta' as const,
      name: entry.id,
      libraryTemplateName: matched?.name || entry.fallbackLibraryName,
      submitMode: 'clone' as const,
      ready: false,
    };
  });
}
