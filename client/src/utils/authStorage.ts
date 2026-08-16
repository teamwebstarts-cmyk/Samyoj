/**
 * Live JWTs live in sessionStorage (per tab) — SAMYOJ-49 Pick A.
 *
 * localStorage is NOT the live session. Logout in this tab only clears this
 * tab’s sessionStorage; other tabs keep their own tokens.
 *
 * localStorage keys that are not live JWTs:
 * - `samyoj_oauth_auth_handoff`: short-lived copy so a Facebook OAuth *popup*
 *   (new window → empty sessionStorage) can restore tokens after redirect.
 *   Same-tab full-page redirect uses sessionStorage backup instead.
 *
 * XSS can still read sessionStorage. HttpOnly cookies are SAMYOJ-3, not this ticket.
 */

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
const BACKUP_KEY = 'samyoj_auth_backup';
const OAUTH_RETURN_KEY = 'samyoj_oauth_return';
/** Popup-only handoff. Not the live JWT source. */
const OAUTH_HANDOFF_KEY = 'samyoj_oauth_auth_handoff';

const BACKUP_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const HANDOFF_MAX_AGE_MS = 15 * 60 * 1000;

type StoredAuth = {
  accessToken?: string | null;
  refreshToken?: string | null;
  savedAt?: number;
};

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

/** Strip leftover live JWT keys so localStorage cannot re-share sessions. */
function stripLegacyLocalJwtKeys() {
  removeStorage(localStorage, ACCESS_KEY);
  removeStorage(localStorage, REFRESH_KEY);
}

export function getAccessToken() {
  return readStorage(sessionStorage, ACCESS_KEY);
}

export function getRefreshToken() {
  return readStorage(sessionStorage, REFRESH_KEY);
}

export function setAuthTokens(accessToken: string, refreshToken: string) {
  writeStorage(sessionStorage, ACCESS_KEY, accessToken);
  writeStorage(sessionStorage, REFRESH_KEY, refreshToken);
  stripLegacyLocalJwtKeys();
}

export function clearAuthTokens() {
  removeStorage(sessionStorage, ACCESS_KEY);
  removeStorage(sessionStorage, REFRESH_KEY);
  stripLegacyLocalJwtKeys();
}

function parseStoredAuth(raw: string | null, maxAgeMs: number): StoredAuth | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredAuth;
    if (parsed.savedAt && Date.now() - parsed.savedAt > maxAgeMs) return null;
    if (!parsed.accessToken && !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function applyStoredAuth(parsed: StoredAuth): boolean {
  if (parsed.accessToken && parsed.refreshToken) {
    setAuthTokens(parsed.accessToken, parsed.refreshToken);
    return true;
  }
  if (parsed.accessToken) writeStorage(sessionStorage, ACCESS_KEY, parsed.accessToken);
  if (parsed.refreshToken) writeStorage(sessionStorage, REFRESH_KEY, parsed.refreshToken);
  stripLegacyLocalJwtKeys();
  return Boolean(parsed.accessToken || parsed.refreshToken);
}

/** True on the Meta OAuth popup or callback route (empty sessionStorage after Facebook). */
export function isWhatsAppOAuthReturn(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.name === 'samyoj_meta_whatsapp_oauth') return true;
  return window.location.pathname.startsWith('/settings/whatsapp/callback');
}

/**
 * One-time lift after SAMYOJ-49: first tab that boots with leftover localStorage
 * JWTs adopts them into this tab’s sessionStorage and deletes the shared keys
 * so other tabs cannot keep using the old browser-wide session.
 */
export function adoptLegacyLocalStorageTokens(): boolean {
  if (getAccessToken() || getRefreshToken()) {
    stripLegacyLocalJwtKeys();
    return false;
  }
  const accessToken = readStorage(localStorage, ACCESS_KEY);
  const refreshToken = readStorage(localStorage, REFRESH_KEY);
  if (!accessToken && !refreshToken) return false;
  if (accessToken && refreshToken) {
    setAuthTokens(accessToken, refreshToken);
    return true;
  }
  if (accessToken) writeStorage(sessionStorage, ACCESS_KEY, accessToken);
  if (refreshToken) writeStorage(sessionStorage, REFRESH_KEY, refreshToken);
  stripLegacyLocalJwtKeys();
  return true;
}

/** Call right before leaving the app for Meta OAuth (popup or full-page redirect). */
export function backupAuthBeforeOAuth(returnPath = '/settings?tab=whatsapp') {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  const payload = JSON.stringify({ accessToken, refreshToken, savedAt: Date.now() });
  if (accessToken || refreshToken) {
    writeStorage(sessionStorage, BACKUP_KEY, payload);
    // Popup is a different window with empty sessionStorage; same-tab redirect
    // still uses the sessionStorage backup above.
    writeStorage(localStorage, OAUTH_HANDOFF_KEY, payload);
  }
  writeStorage(sessionStorage, OAUTH_RETURN_KEY, returnPath);
}

/** Restore tokens if this tab’s session was empty after Facebook. */
export function restoreAuthBackupIfNeeded(options?: { consumeLocalHandoff?: boolean }) {
  if (getAccessToken() || getRefreshToken()) return false;

  const sessionBackup = parseStoredAuth(readStorage(sessionStorage, BACKUP_KEY), BACKUP_MAX_AGE_MS);
  if (sessionBackup && applyStoredAuth(sessionBackup)) return true;
  if (readStorage(sessionStorage, BACKUP_KEY) && !sessionBackup) {
    removeStorage(sessionStorage, BACKUP_KEY);
  }

  const allowHandoff = options?.consumeLocalHandoff ?? isWhatsAppOAuthReturn();
  if (!allowHandoff) return false;

  const handoff = parseStoredAuth(readStorage(localStorage, OAUTH_HANDOFF_KEY), HANDOFF_MAX_AGE_MS);
  removeStorage(localStorage, OAUTH_HANDOFF_KEY);
  if (!handoff) return false;
  return applyStoredAuth(handoff);
}

export function clearAuthBackup() {
  removeStorage(sessionStorage, BACKUP_KEY);
  removeStorage(localStorage, OAUTH_HANDOFF_KEY);
}

export function consumeOAuthReturnPath() {
  const path = readStorage(sessionStorage, OAUTH_RETURN_KEY);
  removeStorage(sessionStorage, OAUTH_RETURN_KEY);
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
