/**
 * Live JWTs live in sessionStorage (per tab) — SAMYOJ-49 Pick A.
 *
 * A new tab/window starts logged out. Chrome copies sessionStorage on
 * duplicate / Ctrl+click; discardClonedSession drops that clone when another
 * live tab already owns the same token pair.
 *
 * localStorage is NOT the live session. Leftover JWT keys are stripped, not
 * adopted into a blank tab.
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

const AUTH_LOCK_CHANNEL = 'samyoj-auth-lock';
const AUTH_LOCK_WAIT_MS = 60;

type AuthLockMsg = { type: 'ping' | 'pong'; fp: string; from: string };

let authInstanceId = '';
let authLockChannel: BroadcastChannel | null = null;

function getAuthInstanceId(): string {
  if (!authInstanceId) {
    authInstanceId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return authInstanceId;
}

function sessionFingerprint(): string | null {
  const access = getAccessToken();
  const refresh = getRefreshToken();
  if (!access && !refresh) return null;
  return `${refresh || ''}|${access || ''}`;
}

function ensureAuthLockChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (authLockChannel) return authLockChannel;
  try {
    authLockChannel = new BroadcastChannel(AUTH_LOCK_CHANNEL);
  } catch {
    return null;
  }
  const replyIfOwner = (event: MessageEvent<AuthLockMsg>) => {
    const data = event.data;
    const from = getAuthInstanceId();
    if (!data || data.from === from || data.type !== 'ping') return;
    const fp = sessionFingerprint();
    if (fp && data.fp === fp) {
      authLockChannel?.postMessage({ type: 'pong', fp, from });
    }
  };
  authLockChannel.addEventListener('message', replyIfOwner);
  authLockChannel.onmessage = replyIfOwner;
  return authLockChannel;
}

async function pingForDuplicateOwner(fp: string): Promise<boolean> {
  const ch = ensureAuthLockChannel();
  if (!ch) return false;
  const from = getAuthInstanceId();
  let duplicate = false;
  const onPong = (event: MessageEvent<AuthLockMsg>) => {
    const data = event.data;
    if (data?.type === 'pong' && data.fp === fp && data.from !== from) duplicate = true;
  };
  ch.addEventListener('message', onPong);
  ch.postMessage({ type: 'ping', fp, from });
  await new Promise((resolve) => {
    setTimeout(resolve, AUTH_LOCK_WAIT_MS);
  });
  ch.removeEventListener('message', onPong);
  return duplicate;
}

/**
 * Chrome copies sessionStorage when a tab is duplicated or opened via Ctrl+click.
 * If another live tab already owns this token pair, drop it here so a new window
 * starts logged out. Explicit login in this tab (new refresh token) is kept.
 */
export async function discardClonedSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (isWhatsAppOAuthReturn()) return false;
  const fp = sessionFingerprint();
  if (!fp) return false;

  const duplicate = await pingForDuplicateOwner(fp);

  if (duplicate) {
    clearAuthTokens();
    return true;
  }
  return false;
}

/** Test-only: drop the BroadcastChannel singleton between cases. */
export function __resetAuthLockForTests() {
  authInstanceId = '';
  try {
    authLockChannel?.close();
  } catch {
    // ignore
  }
  authLockChannel = null;
}

/**
 * Leftover localStorage JWTs must not log a blank tab in. Strip them.
 * Live session is sessionStorage only (plus clone discard below).
 */
export function adoptLegacyLocalStorageTokens(): boolean {
  stripLegacyLocalJwtKeys();
  return false;
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
