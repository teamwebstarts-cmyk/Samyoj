import { CSRF_HEADER, clearCsrfToken, resolveCsrfToken, setCsrfToken } from './lib/session';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Success<T> = { success: true; data: T };
type Failure = { success: false; error?: { message?: string; code?: string } };

function rememberCsrf(data: unknown): void {
  if (!data || typeof data !== 'object') return;
  const token = (data as { csrfToken?: unknown }).csrfToken;
  if (typeof token === 'string' && token.length > 0) setCsrfToken(token);
}

export async function platformRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const csrf = resolveCsrfToken();
  if (csrf) headers.set(CSRF_HEADER, csrf);

  const response = await fetch(`/api/platform${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
  const json = (await response.json().catch(() => ({}))) as Success<T> | Failure;
  if (!response.ok || !('success' in json) || json.success !== true) {
    if (response.status === 401) clearCsrfToken();
    const failure = json as Failure;
    throw new ApiError(
      failure.error?.message || 'Request failed',
      response.status,
      failure.error?.code
    );
  }
  rememberCsrf(json.data);
  return json.data;
}

export async function refreshPlatformCsrf(): Promise<void> {
  await platformRequest<{ csrfToken: string }>('/auth/csrf');
}
