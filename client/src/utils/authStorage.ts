/**
 * Tenant auth uses HttpOnly cookies (SAMYOJ-3). Live JWTs are never stored in
 * sessionStorage or localStorage.
 *
 * The readable `samyoj_csrf` cookie (Path=/) is used for double-submit CSRF on
 * mutating API calls. Session presence is inferred from that cookie or /auth/me.
 */

const CSRF_COOKIE = 'samyoj_csrf';
const OAUTH_RETURN_KEY = 'samyoj_oauth_return';

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // private mode / quota
  }
}

function removeStorage(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Strip legacy JWT keys from any storage (SAMYOJ-49 cleanup). */
export function clearAuthTokens() {
  for (const key of ['accessToken', 'refreshToken', 'samyoj_auth_backup', 'samyoj_oauth_auth_handoff']) {
    removeStorage(sessionStorage, key);
    removeStorage(localStorage, key);
  }
}

export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${CSRF_COOKIE}=`)) {
      try {
        return decodeURIComponent(trimmed.slice(CSRF_COOKIE.length + 1));
      } catch {
        return trimmed.slice(CSRF_COOKIE.length + 1);
      }
    }
  }
  return null;
}

/** True when the CSRF cookie indicates an active cookie session. */
export function hasAuthSessionHint(): boolean {
  return Boolean(getCsrfToken());
}

/** Drop the readable CSRF hint when HttpOnly cookies are gone or invalid. */
export function clearClientSessionCookies(): void {
  if (typeof document === 'undefined') return;
  document.cookie = 'samyoj_csrf=; Path=/; Max-Age=0; SameSite=Strict';
}

/** @deprecated HttpOnly cookies replaced tab-scoped JWT storage. */
export function getAccessToken(): null {
  return null;
}

/** @deprecated HttpOnly cookies replaced tab-scoped JWT storage. */
export function getRefreshToken(): null {
  return null;
}

/** @deprecated Server sets HttpOnly cookies on login/register/refresh. */
export function setAuthTokens(_accessToken: string, _refreshToken: string) {
  // no-op — cookies are set by the API
}

/** True on the Meta OAuth popup or callback route. */
export function isWhatsAppOAuthReturn(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.name === 'samyoj_meta_whatsapp_oauth') return true;
  return window.location.pathname.startsWith('/settings/whatsapp/callback');
}

/** Call right before leaving the app for Meta OAuth (popup or full-page redirect). */
export function backupAuthBeforeOAuth(returnPath = '/settings?tab=whatsapp') {
  writeStorage(sessionStorage, OAUTH_RETURN_KEY, returnPath);
}

/** OAuth return path only — session cookies survive the redirect. */
export function restoreAuthBackupIfNeeded(): boolean {
  return false;
}

export function clearAuthBackup() {
  removeStorage(sessionStorage, OAUTH_RETURN_KEY);
}

export function consumeOAuthReturnPath() {
  const path = readStorage(sessionStorage, OAUTH_RETURN_KEY);
  removeStorage(sessionStorage, OAUTH_RETURN_KEY);
  return path && path.startsWith('/') && !path.startsWith('//') ? path : null;
}

/** @deprecated Clone-session guard not needed with HttpOnly cookies. */
export async function discardClonedSession(): Promise<boolean> {
  return false;
}

/** @deprecated */
export function adoptLegacyLocalStorageTokens(): boolean {
  clearAuthTokens();
  return false;
}

/** @deprecated */
export function __resetAuthLockForTests() {
  // no-op
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
