import { describe, expect, it } from 'vitest';
import { isPlatformMfaRequired, resolvePlatformPasswordLogin } from './mfa-policy';

describe('platform MFA requirement flag', () => {
  it('defaults off in development and on in production', () => {
    expect(isPlatformMfaRequired('development', undefined)).toBe(false);
    expect(isPlatformMfaRequired('development', '')).toBe(false);
    expect(isPlatformMfaRequired('production', undefined)).toBe(true);
    expect(isPlatformMfaRequired('production', '')).toBe(true);
    expect(isPlatformMfaRequired('test', undefined)).toBe(true);
  });

  it('lets PLATFORM_MFA_REQUIRED override NODE_ENV', () => {
    expect(isPlatformMfaRequired('development', 'true')).toBe(true);
    expect(isPlatformMfaRequired('development', '1')).toBe(true);
    expect(isPlatformMfaRequired('production', 'false')).toBe(false);
    expect(isPlatformMfaRequired('production', '0')).toBe(false);
    expect(isPlatformMfaRequired('production', 'no')).toBe(false);
  });
});

describe('platform password login after a valid password', () => {
  const pendingSecret = {
    mfaEnabledAt: null,
    totpSecretEncrypted: 'enc:PENDINGSECRET',
  };

  it('returns AUTHENTICATED without TOTP when MFA is not required, even with a pending secret', () => {
    expect(
      resolvePlatformPasswordLogin({
        mfaRequired: false,
        ...pendingSecret,
      })
    ).toEqual({ status: 'AUTHENTICATED' });
    expect(
      resolvePlatformPasswordLogin({
        mfaRequired: false,
        mfaEnabledAt: new Date('2026-01-01'),
        totpSecretEncrypted: 'enc:ENROLLED',
      })
    ).toEqual({ status: 'AUTHENTICATED' });
  });

  it('still requires enroll then verify when MFA is required (production default)', () => {
    expect(
      resolvePlatformPasswordLogin({
        mfaRequired: true,
        mfaEnabledAt: null,
        totpSecretEncrypted: null,
      })
    ).toEqual({ status: 'MFA_ENROLLMENT_REQUIRED' });
    expect(
      resolvePlatformPasswordLogin({
        mfaRequired: true,
        mfaEnabledAt: new Date('2026-01-01'),
        totpSecretEncrypted: 'enc:ENROLLED',
      })
    ).toEqual({ status: 'MFA_REQUIRED' });
    expect(
      resolvePlatformPasswordLogin({
        mfaRequired: true,
        mfaEnabledAt: new Date('2026-01-01'),
        totpSecretEncrypted: 'enc:ENROLLED',
        totpCode: '123456',
        totpValid: true,
      })
    ).toEqual({ status: 'AUTHENTICATED' });
  });
});
