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

export function isRequestAborted(err: unknown): boolean {
  const e = err as { code?: string; name?: string; message?: string };
  return (
    e?.code === 'ERR_CANCELED' ||
    e?.name === 'CanceledError' ||
    e?.message === 'canceled' ||
    e?.message === 'cancelled'
  );
}
