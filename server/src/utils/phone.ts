import { z } from 'zod';

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

export const phoneFieldSchema = z.string().transform((val, ctx) => {
  const result = validatePhone(val);
  if (!result.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
    return z.NEVER;
  }
  return result.phone;
});
