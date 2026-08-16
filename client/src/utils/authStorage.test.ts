import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  accessTokenNeedsRefresh,
  adoptLegacyLocalStorageTokens,
  backupAuthBeforeOAuth,
  clearAuthBackup,
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  readJwtExpMs,
  restoreAuthBackupIfNeeded,
  setAuthTokens,
} from './authStorage';

function jwtWithExp(expSeconds: number): string {
  const json = JSON.stringify({ exp: expSeconds });
  const payload = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `header.${payload}.sig`;
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('localStorage', memoryStorage());
});

describe('accessTokenNeedsRefresh', () => {
  it('refreshes when there is no access token', () => {
    expect(accessTokenNeedsRefresh(null)).toBe(true);
    expect(accessTokenNeedsRefresh('')).toBe(true);
  });

  it('does not refresh a token that is still valid', () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 15 * 60);
    expect(accessTokenNeedsRefresh(token)).toBe(false);
    expect(readJwtExpMs(token)).toBeGreaterThan(Date.now());
  });

  it('refreshes when the token is within the skew window', () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 30);
    expect(accessTokenNeedsRefresh(token, Date.now(), 60_000)).toBe(true);
  });

  it('does not hammer refresh when the JWT payload cannot be parsed', () => {
    expect(accessTokenNeedsRefresh('not-a-jwt')).toBe(false);
  });
});

describe('tab-scoped sessionStorage JWTs (SAMYOJ-49 Pick A)', () => {
  it('stores live tokens in sessionStorage, not localStorage', () => {
    setAuthTokens('access-a', 'refresh-a');
    expect(sessionStorage.getItem('accessToken')).toBe('access-a');
    expect(sessionStorage.getItem('refreshToken')).toBe('refresh-a');
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(getAccessToken()).toBe('access-a');
    expect(getRefreshToken()).toBe('refresh-a');
  });

  it('logout clears this tab sessionStorage and leftover localStorage JWT keys', () => {
    sessionStorage.setItem('accessToken', 'tab-a');
    localStorage.setItem('accessToken', 'stale-shared');
    localStorage.setItem('refreshToken', 'stale-shared');
    clearAuthTokens();
    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('does not use localStorage as the live JWT source after login', () => {
    localStorage.setItem('accessToken', 'other-tab-should-not-win');
    setAuthTokens('this-tab', 'this-tab-refresh');
    expect(getAccessToken()).toBe('this-tab');
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('adopts leftover localStorage JWTs once, then strips the shared keys', () => {
    localStorage.setItem('accessToken', 'legacy-access');
    localStorage.setItem('refreshToken', 'legacy-refresh');
    expect(adoptLegacyLocalStorageTokens()).toBe(true);
    expect(getAccessToken()).toBe('legacy-access');
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('restores same-tab OAuth backup into sessionStorage', () => {
    setAuthTokens('pre-oauth', 'pre-oauth-refresh');
    backupAuthBeforeOAuth('/settings?tab=whatsapp');
    clearAuthTokens();
    expect(getAccessToken()).toBeNull();
    expect(restoreAuthBackupIfNeeded({ consumeLocalHandoff: false })).toBe(true);
    expect(getAccessToken()).toBe('pre-oauth');
    expect(sessionStorage.getItem('accessToken')).toBe('pre-oauth');
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('does not let another tab consume the OAuth popup handoff', () => {
    setAuthTokens('opener', 'opener-refresh');
    backupAuthBeforeOAuth();
    clearAuthTokens();
    expect(restoreAuthBackupIfNeeded({ consumeLocalHandoff: false })).toBe(true);
    // sessionStorage backup still restored in this tab; a blank tab must not
    // steal the localStorage handoff.
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('samyoj_auth_backup');
    expect(restoreAuthBackupIfNeeded({ consumeLocalHandoff: false })).toBe(false);
    expect(localStorage.getItem('samyoj_oauth_auth_handoff')).toBeTruthy();
  });

  it('OAuth popup may consume the localStorage handoff into this window sessionStorage', () => {
    localStorage.setItem(
      'samyoj_oauth_auth_handoff',
      JSON.stringify({ accessToken: 'popup', refreshToken: 'popup-refresh', savedAt: Date.now() })
    );
    expect(restoreAuthBackupIfNeeded({ consumeLocalHandoff: true })).toBe(true);
    expect(getAccessToken()).toBe('popup');
    expect(localStorage.getItem('samyoj_oauth_auth_handoff')).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('clearAuthBackup does not wipe another conceptual tab session (only backup keys)', () => {
    setAuthTokens('stay', 'stay-refresh');
    backupAuthBeforeOAuth();
    clearAuthBackup();
    expect(getAccessToken()).toBe('stay');
    expect(sessionStorage.getItem('samyoj_auth_backup')).toBeNull();
    expect(localStorage.getItem('samyoj_oauth_auth_handoff')).toBeNull();
  });
});
