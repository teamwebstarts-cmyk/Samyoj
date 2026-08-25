import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adoptLegacyLocalStorageTokens,
  backupAuthBeforeOAuth,
  clearAuthBackup,
  clearAuthTokens,
  consumeOAuthReturnPath,
  discardClonedSession,
  getAccessToken,
  getCsrfToken,
  getRefreshToken,
  hasAuthSessionHint,
  restoreAuthBackupIfNeeded,
  setAuthTokens,
} from './authStorage';

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

function setDocumentCookie(value: string) {
  (document as { cookie: string }).cookie = value;
}

beforeEach(() => {
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('localStorage', memoryStorage());
  let cookieValue = '';
  vi.stubGlobal('document', {
    get cookie() {
      return cookieValue;
    },
    set cookie(value: string) {
      cookieValue = value;
    },
  });
  setDocumentCookie('');
});

describe('HttpOnly cookie auth (SAMYOJ-3)', () => {
  it('does not store JWTs in browser storage', () => {
    setAuthTokens('access-a', 'refresh-a');
    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(sessionStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('clears legacy JWT keys from sessionStorage and localStorage', () => {
    sessionStorage.setItem('accessToken', 'tab-a');
    localStorage.setItem('accessToken', 'stale-shared');
    localStorage.setItem('refreshToken', 'stale-shared');
    clearAuthTokens();
    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('reads the readable CSRF cookie for session hints', () => {
    setDocumentCookie('samyoj_csrf=csrf-token-123; Path=/');
    expect(getCsrfToken()).toBe('csrf-token-123');
    expect(hasAuthSessionHint()).toBe(true);
  });

  it('has no session hint when the CSRF cookie is absent', () => {
    expect(getCsrfToken()).toBeNull();
    expect(hasAuthSessionHint()).toBe(false);
  });

  it('strips leftover localStorage JWTs without adopting them', () => {
    localStorage.setItem('accessToken', 'legacy-access');
    localStorage.setItem('refreshToken', 'legacy-refresh');
    expect(adoptLegacyLocalStorageTokens()).toBe(false);
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});

describe('OAuth return path helpers', () => {
  it('stores and consumes a safe return path', () => {
    backupAuthBeforeOAuth('/settings?tab=whatsapp');
    expect(consumeOAuthReturnPath()).toBe('/settings?tab=whatsapp');
    expect(consumeOAuthReturnPath()).toBeNull();
  });

  it('rejects unsafe return paths', () => {
    sessionStorage.setItem('samyoj_oauth_return', '//evil.example');
    expect(consumeOAuthReturnPath()).toBeNull();
  });

  it('does not restore JWT backups after OAuth', () => {
    backupAuthBeforeOAuth('/settings?tab=whatsapp');
    clearAuthTokens();
    expect(restoreAuthBackupIfNeeded()).toBe(false);
    expect(getAccessToken()).toBeNull();
  });

  it('clearAuthBackup removes only the OAuth return key', () => {
    backupAuthBeforeOAuth('/settings?tab=whatsapp');
    clearAuthBackup();
    expect(sessionStorage.getItem('samyoj_oauth_return')).toBeNull();
  });
});

describe('deprecated clone-session helpers', () => {
  it('discardClonedSession is a no-op with cookie auth', async () => {
    await expect(discardClonedSession()).resolves.toBe(false);
  });
});
