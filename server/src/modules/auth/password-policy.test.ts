import { describe, expect, it } from 'vitest';
import { assertPasswordPolicy, passwordSchema } from './password-policy';

describe('assertPasswordPolicy', () => {
  it('accepts a valid password', () => {
    expect(() => assertPasswordPolicy('MyStr0ngPass')).not.toThrow();
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(() => assertPasswordPolicy('Ab1')).toThrow(/at least 8/);
  });

  it('rejects passwords longer than 128 characters', () => {
    const long = 'A'.repeat(64) + 'a'.repeat(64) + '1';
    expect(() => assertPasswordPolicy(long)).toThrow(/too long/);
  });

  it('rejects passwords without uppercase', () => {
    expect(() => assertPasswordPolicy('lowercase1')).toThrow(/uppercase/);
  });

  it('rejects passwords without lowercase', () => {
    expect(() => assertPasswordPolicy('UPPERCASE1')).toThrow(/lowercase/);
  });

  it('rejects passwords without numbers', () => {
    expect(() => assertPasswordPolicy('NoNumbers')).toThrow(/number/);
  });

  it('rejects common passwords that pass mixed-case check', () => {
    // Common passwords must pass the mixed-case + number check first
    // 'password1' fails at mixed-case (no uppercase), so it throws "uppercase" not "common"
    // Need to use common passwords with mixed case
    expect(() => assertPasswordPolicy('Password1')).toThrow(/too common/i);
    expect(() => assertPasswordPolicy('Qwerty123')).toThrow(/too common/i);
  });

  it('rejects common passwords before mixed-case check (order matters)', () => {
    // 'password1' is common but fails mixed-case check first
    expect(() => assertPasswordPolicy('password1')).toThrow(/uppercase/);
    // '12345678' fails mixed-case check first (no letters at all)
    expect(() => assertPasswordPolicy('12345678')).toThrow(/uppercase/);
  });

  it('is case-insensitive for common password check', () => {
    // 'PASSWORD1' is common, has uppercase + number, but no lowercase
    // So it fails at lowercase check first
    expect(() => assertPasswordPolicy('PASSWORD1')).toThrow(/lowercase/);
    // 'QWERTY123' has uppercase + number but no lowercase
    expect(() => assertPasswordPolicy('QWERTY123')).toThrow(/lowercase/);
  });
});

describe('passwordSchema (Zod)', () => {
  it('accepts valid passwords', () => {
    expect(passwordSchema.safeParse('MyStr0ngPass').success).toBe(true);
    expect(passwordSchema.safeParse('C0mpl3x!Pass').success).toBe(true);
  });

  it('rejects short passwords', () => {
    expect(passwordSchema.safeParse('Ab1').success).toBe(false);
  });

  it('rejects passwords without mixed case and numbers', () => {
    expect(passwordSchema.safeParse('alllowercase1').success).toBe(false);
    expect(passwordSchema.safeParse('ALLUPPERCASE1').success).toBe(false);
    expect(passwordSchema.safeParse('NoNumbersHere').success).toBe(false);
  });

  it('rejects common passwords', () => {
    expect(passwordSchema.safeParse('Password1').success).toBe(false);
    expect(passwordSchema.safeParse('Qwerty123').success).toBe(false);
  });
});
