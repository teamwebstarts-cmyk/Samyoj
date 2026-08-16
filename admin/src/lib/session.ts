export { maskBusinessPhone } from './masking';

export const CSRF_COOKIE = 'samyoj_platform_csrf';
export const CSRF_HEADER = 'x-platform-csrf-token';

let csrfMemory: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfMemory = token && token.length > 0 ? token : null;
}

export function getCsrfToken(): string | null {
  return csrfMemory;
}

export function clearCsrfToken(): void {
  csrfMemory = null;
}

/** CSRF cookie is Path=/ and readable. Memory covers JSON tokens from login/enroll/csrf. */
export function resolveCsrfToken(): string | null {
  return readCookie(CSRF_COOKIE) ?? getCsrfToken();
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}
