/** Display-friendly phone label for non-technical users */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length > 10) {
    return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -5)} ${digits.slice(-5)}`;
  }
  return phone.startsWith('+') ? phone : `+${phone}`;
}
