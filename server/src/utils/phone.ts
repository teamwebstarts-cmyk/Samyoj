import { z } from 'zod';

export type PhoneValidationResult =
  | { ok: true; phone: string }
  | { ok: false; error: string };

/** Stable digits-only identity used for number-scoped database keys. */
export function normalizePhoneIdentity(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  return digits;
}

export function normalizePhone(input: string): string {
  return normalizePhoneIdentity(input);
}

/**
 * WhatsApp `wa_id` vs a number the customer typed in a flow.
 * Last-10 match covers "9009785315" vs "919009785315" without treating a typo as the same person.
 */
export function isSamePhoneIdentity(a: string, b: string): boolean {
  const left = normalizePhoneIdentity(a);
  const right = normalizePhoneIdentity(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 10 && right.length >= 10 && left.slice(-10) === right.slice(-10)) return true;
  return false;
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

export const phoneFieldSchema = z.string().transform((val, ctx) => {
  const result = validatePhone(val);
  if (!result.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
    return z.NEVER;
  }
  return result.phone;
});
