import { formatPhoneDisplay } from './formatPhone';

export const WHATSAPP_BUSINESS_FALLBACK = 'WhatsApp Business';

export type WhatsAppPreviewIdentityInput = {
  companyName?: string | null;
  phoneNumber?: string | null;
  officialBusinessAccount?: boolean | null;
};

export type WhatsAppPreviewIdentity = {
  title: string;
  subtitle: string | null;
  initials: string;
  showOfficialBadge: boolean;
  usingFallback: boolean;
};

function initialsFromName(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export function resolveWhatsAppPreviewIdentity(
  input: WhatsAppPreviewIdentityInput,
): WhatsAppPreviewIdentity {
  const company = input.companyName?.trim() || '';
  const usingFallback = !company;
  const title = company || WHATSAPP_BUSINESS_FALLBACK;
  const rawPhone = input.phoneNumber?.trim() || '';
  const subtitle = rawPhone ? formatPhoneDisplay(rawPhone) : null;

  return {
    title,
    subtitle,
    initials: company ? initialsFromName(company) : '',
    showOfficialBadge: Boolean(input.officialBusinessAccount),
    usingFallback,
  };
}
