/** Auth token helpers — never wipe unrelated localStorage keys. */

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
const BACKUP_KEY = 'samyoj_auth_backup';
const OAUTH_RETURN_KEY = 'samyoj_oauth_return';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setAuthTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/** Call right before leaving the app for Meta OAuth (full-page redirect fallback). */
export function backupAuthBeforeOAuth(returnPath = '/settings?tab=whatsapp') {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  if (accessToken || refreshToken) {
    sessionStorage.setItem(
      BACKUP_KEY,
      JSON.stringify({ accessToken, refreshToken, savedAt: Date.now() })
    );
  }
  sessionStorage.setItem(OAUTH_RETURN_KEY, returnPath);
}

/** Restore tokens if localStorage was wiped while the user was on Facebook. */
export function restoreAuthBackupIfNeeded() {
  if (getAccessToken() || getRefreshToken()) return false;
  const raw = sessionStorage.getItem(BACKUP_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as {
      accessToken?: string | null;
      refreshToken?: string | null;
      savedAt?: number;
    };
    // Ignore backups older than 2 hours
    if (parsed.savedAt && Date.now() - parsed.savedAt > 2 * 60 * 60 * 1000) {
      sessionStorage.removeItem(BACKUP_KEY);
      return false;
    }
    if (parsed.accessToken) localStorage.setItem(ACCESS_KEY, parsed.accessToken);
    if (parsed.refreshToken) localStorage.setItem(REFRESH_KEY, parsed.refreshToken);
    return Boolean(parsed.accessToken || parsed.refreshToken);
  } catch {
    return false;
  }
}

export function clearAuthBackup() {
  sessionStorage.removeItem(BACKUP_KEY);
}

export function consumeOAuthReturnPath() {
  const path = sessionStorage.getItem(OAUTH_RETURN_KEY);
  sessionStorage.removeItem(OAUTH_RETURN_KEY);
  return path && path.startsWith('/') && !path.startsWith('//') ? path : null;
}

export function readJwtExpMs(token: string | null | undefined): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const json = JSON.parse(atob(padded + pad)) as { exp?: unknown };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Refresh only when the access JWT is missing or within `skewMs` of expiry. */
export function accessTokenNeedsRefresh(
  token: string | null | undefined,
  now = Date.now(),
  skewMs = 60_000
): boolean {
  if (!token) return true;
  const expMs = readJwtExpMs(token);
  if (expMs == null) return false;
  return now >= expMs - skewMs;
}

export function isRequestAborted(err: unknown): boolean {
  const e = err as { code?: string; name?: string; message?: string };
  return (
    e?.code === 'ERR_CANCELED' ||
    e?.name === 'CanceledError' ||
    e?.message === 'canceled' ||
    e?.message === 'cancelled'
  );
}
