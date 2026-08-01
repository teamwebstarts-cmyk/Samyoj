import { z } from 'zod';

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  'qwerty123',
  'admin123',
  'welcome1',
  'letmein1',
  'iloveyou',
]);

/** Stronger than min-8: length + mixed classes + not a common password */
export function assertPasswordPolicy(password: string): void {
  if (password.length < 8) {
    throw Object.assign(new Error('Password must be at least 8 characters'), { status: 400 });
  }
  if (password.length > 128) {
    throw Object.assign(new Error('Password is too long'), { status: 400 });
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw Object.assign(
      new Error('Password must include uppercase, lowercase, and a number'),
      { status: 400 }
    );
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    throw Object.assign(new Error('Password is too common — choose something stronger'), {
      status: 400,
    });
  }
}

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p), {
    message: 'Password must include uppercase, lowercase, and a number',
  })
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), {
    message: 'Password is too common — choose something stronger',
  });
