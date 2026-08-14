/** Google userinfo includes verified_email when the email scope is granted. */
export function googleEmailIsAcceptable(profile: { verified_email?: boolean }): boolean {
  if (profile.verified_email === undefined) return true;
  return profile.verified_email === true;
}

export function oauthBlockedByTwoFactor(twoFactorEnabled: boolean | null | undefined): boolean {
  return twoFactorEnabled === true;
}
