/** Mask a business WhatsApp number for operator UI. Never return the raw value. */
export function maskBusinessPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '••••';
  return `${digits.slice(0, 2)}••••${digits.slice(-2)}`;
}

export function displayMaskedPhone(phone: string | null | undefined): string {
  return maskBusinessPhone(phone) ?? 'Hidden';
}
