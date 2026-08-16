import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateTwoFactorSecret, verifyTotp } from './totp';

afterEach(() => {
  vi.useRealTimers();
});

describe('TOTP', () => {
  it('verifies the RFC 6238 SHA-1 vector with a six-digit code', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(59_000));

    // Base32 for ASCII "12345678901234567890"; RFC code 94287082 -> 287082.
    expect(
      verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 0)
    ).toBe(true);
    expect(
      verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287083', 0)
    ).toBe(false);
  });

  it('uses the platform-specific issuer without changing the default API', () => {
    const platform = generateTwoFactorSecret(
      'ops@example.com',
      'Samyoj Platform Admin'
    );
    const customer = generateTwoFactorSecret('user@example.com');

    expect(platform.otpauthUrl).toContain('Samyoj%20Platform%20Admin');
    expect(customer.otpauthUrl).toContain('WhatsApp%20Platform');
  });
});
