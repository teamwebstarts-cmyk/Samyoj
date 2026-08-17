import { describe, expect, it } from 'vitest';
import { phaseAfterPasswordLogin } from './login';

describe('platform login phases', () => {
  it('does not force authenticator setup after AUTHENTICATED', () => {
    expect(phaseAfterPasswordLogin('AUTHENTICATED')).toBe('authenticated');
  });

  it('shows enroll or TOTP only when the API still requires MFA', () => {
    expect(phaseAfterPasswordLogin('MFA_ENROLLMENT_REQUIRED')).toBe('enroll');
    expect(phaseAfterPasswordLogin('MFA_REQUIRED')).toBe('totp');
  });
});
