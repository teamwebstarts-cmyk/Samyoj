export const PHONE_HINT = 'With country code, no + (e.g. 919876543210)';
export const PHONE_PLACEHOLDER = '919876543210';

export type PhoneValidationResult =
  | { ok: true; phone: string }
  | { ok: false; error: string };

export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  return digits;
}

export function validatePhone(input: string): PhoneValidationResult {
  const phone = normalizePhone(input);

  if (!phone) {
    return { ok: false, error: 'Phone number is required' };
  }
  if (phone.startsWith('0')) {
    return {
      ok: false,
      error: 'Remove leading 0 and use country code (e.g. 919876543210)',
    };
  }
  if (phone.length < 10) {
    return { ok: false, error: 'Phone number is too short' };
  }
  if (phone.length > 15) {
    return { ok: false, error: 'Phone number cannot exceed 15 digits' };
  }
  if (phone.length === 10) {
    return {
      ok: false,
      error: 'Include country code without + (e.g. 919876543210 for India, 14155552671 for US)',
    };
  }
  if (!/^[1-9]\d{9,14}$/.test(phone)) {
    return { ok: false, error: 'Enter a valid international phone number' };
  }

  return { ok: true, phone };
}

export function validatePhoneLines(
  lines: string[],
): { ok: true; phones: string[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const phones: string[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const result = validatePhone(trimmed);
    if (!result.ok) {
      errors.push(`Line ${index + 1}: ${result.error}`);
    } else {
      phones.push(result.phone);
    }
  });

  if (errors.length) return { ok: false, errors };
  if (!phones.length) return { ok: false, errors: ['Add at least one phone number'] };

  return { ok: true, phones };
}
