export const PHONE_HINT = 'With country code, no + (e.g. 919876543210)';
export const PHONE_PLACEHOLDER = '919876543210';

export const INDIA_COUNTRY_CODE = '91';
export const INDIA_LOCAL_PHONE_PLACEHOLDER = '9876543210';

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

/** Keep at most 10 digits for India local mobile input. */
export function sanitizeIndiaLocalPhoneInput(input: string): string {
  return normalizePhone(input).slice(0, 10);
}

/** Show 10-digit local part when a stored value is 91XXXXXXXXXX or already local. */
export function toIndiaLocalDisplay(input: string): string {
  const digits = normalizePhone(input);
  if (digits.startsWith(INDIA_COUNTRY_CODE) && digits.length > INDIA_COUNTRY_CODE.length) {
    return digits.slice(INDIA_COUNTRY_CODE.length, INDIA_COUNTRY_CODE.length + 10);
  }
  return digits.slice(0, 10);
}

export function validateIndiaLocalPhone(input: string): PhoneValidationResult {
  const local = sanitizeIndiaLocalPhoneInput(input);
  if (!local) {
    return { ok: false, error: 'Enter a 10-digit mobile number' };
  }
  if (local.length !== 10) {
    return { ok: false, error: 'Enter all 10 digits' };
  }
  if (!/^[6-9]\d{9}$/.test(local)) {
    return { ok: false, error: 'Enter a valid Indian mobile number' };
  }
  return { ok: true, phone: `${INDIA_COUNTRY_CODE}${local}` };
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

export function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return '';
  const digits = normalizePhone(phone);
  if (digits.startsWith('91') && digits.length === 12) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return digits.startsWith('+') ? digits : `+${digits}`;
}

