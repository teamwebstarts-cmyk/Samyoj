import type { LoginState } from '../types';

export type LoginPhase = 'password' | 'enroll' | 'totp' | 'authenticated';

export function phaseAfterPasswordLogin(
  state: LoginState
): Exclude<LoginPhase, 'password'> {
  if (state === 'AUTHENTICATED') return 'authenticated';
  if (state === 'MFA_ENROLLMENT_REQUIRED') return 'enroll';
  return 'totp';
}
