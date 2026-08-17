export type PlatformPasswordLoginStatus =
  | 'AUTHENTICATED'
  | 'MFA_ENROLLMENT_REQUIRED'
  | 'MFA_REQUIRED'
  | 'INVALID_MFA'
  | 'INVALID_CONFIG';

function parseOptionalBool(raw: string | undefined): boolean | undefined {
  const value = raw?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === 'true' || value === '1' || value === 'yes') return true;
  if (value === 'false' || value === '0' || value === 'no') return false;
  return undefined;
}

/**
 * Platform-admin TOTP. Explicit PLATFORM_MFA_REQUIRED wins.
 * Unset: skippable in NODE_ENV=development, required in production (and test).
 */
export function isPlatformMfaRequired(
  nodeEnv = process.env.NODE_ENV,
  rawFlag = process.env.PLATFORM_MFA_REQUIRED
): boolean {
  const explicit = parseOptionalBool(rawFlag);
  if (explicit !== undefined) return explicit;
  return nodeEnv !== 'development';
}

export function resolvePlatformPasswordLogin(input: {
  mfaRequired?: boolean;
  mfaEnabledAt: Date | null;
  totpSecretEncrypted: string | null;
  totpCode?: string;
  totpValid?: boolean;
}): { status: PlatformPasswordLoginStatus } {
  const mfaRequired = input.mfaRequired ?? isPlatformMfaRequired();
  if (!mfaRequired) {
    return { status: 'AUTHENTICATED' };
  }
  if (!input.mfaEnabledAt) {
    return { status: 'MFA_ENROLLMENT_REQUIRED' };
  }
  if (!input.totpSecretEncrypted) {
    return { status: 'INVALID_CONFIG' };
  }
  if (!input.totpCode) {
    return { status: 'MFA_REQUIRED' };
  }
  if (!input.totpValid) {
    return { status: 'INVALID_MFA' };
  }
  return { status: 'AUTHENTICATED' };
}
