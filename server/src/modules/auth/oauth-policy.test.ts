import { describe, expect, it } from 'vitest';
import { googleEmailIsAcceptable, oauthBlockedByTwoFactor } from './oauth-policy';

describe('Google OAuth policy', () => {
  it('rejects verified_email=false and allows omitted or true', () => {
    expect(googleEmailIsAcceptable({ verified_email: false })).toBe(false);
    expect(googleEmailIsAcceptable({ verified_email: true })).toBe(true);
    expect(googleEmailIsAcceptable({})).toBe(true);
  });

  it('blocks OAuth session issue when 2FA is enabled', () => {
    expect(oauthBlockedByTwoFactor(true)).toBe(true);
    expect(oauthBlockedByTwoFactor(false)).toBe(false);
    expect(oauthBlockedByTwoFactor(undefined)).toBe(false);
  });
});
