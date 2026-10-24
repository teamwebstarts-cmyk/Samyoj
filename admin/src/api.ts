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

function isLogin(path: string, method: string): boolean {
  return method === 'POST' && path === '/auth/login';
}

export async function platformRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (mutating && !isLogin(path, method)) {
    const csrf = resolveCsrfToken();
    if (csrf) headers.set(CSRF_HEADER, csrf);
  }

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

/** One AI-suggested library-template draft (bilingual, shared variable roster). */
export type AiTemplateDraftSuggestion = {
  title: string;
  slug: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  body: string;
  bodyHi: string;
  footer: string;
  footerHi: string;
  buttons: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';
    text: string;
    url?: string;
    phone_number?: string;
    example?: string;
  }>;
  variables: Array<{ index: number; description: string; suggestedSource: string }>;
};

/**
 * Platform AI services — mirrors the tenant aiStudioApi boiler (client/src/services/api.ts)
 * but for the operator console: same platformRequest transport, org-independent.
 * POST /platform/library-templates/ai-draft → { drafts: [...] } | { clarify: string[] }
 * (vague prompt → the model asks up to 3 short questions instead of guessing).
 */
export const aiApi = {
  generateTemplateDrafts: (prompt: string) =>
    platformRequest<{ drafts: AiTemplateDraftSuggestion[]; clarify?: string[] }>('/library-templates/ai-draft', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
};

