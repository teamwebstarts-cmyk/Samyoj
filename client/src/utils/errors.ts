import { AxiosError, isAxiosError } from 'axios';

export type ClientErrorSource = 'api' | 'react' | 'socket' | 'auth' | 'ui' | 'global' | 'inbox';

export interface ClientErrorContext {
  source?: ClientErrorSource;
  action?: string;
  method?: string;
  url?: string;
  status?: number;
  component?: string;
  [key: string]: unknown;
}

export interface NormalizedClientError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
  stack?: string;
  isNetworkError: boolean;
  original?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readApiErrorPayload(data: unknown): { message?: string; code?: string; details?: unknown } {
  if (!isRecord(data)) return {};

  const errorField = data.error;
  if (isRecord(errorField)) {
    return {
      message: typeof errorField.message === 'string' ? errorField.message : undefined,
      code: typeof errorField.code === 'string' ? errorField.code : undefined,
      details: errorField.details,
    };
  }

  if (typeof data.message === 'string') {
    return { message: data.message };
  }

  return {};
}

export function normalizeError(err: unknown): NormalizedClientError {
  if (isAxiosError(err)) {
    const axiosErr = err as AxiosError<{ error?: { message?: string; code?: string; details?: unknown } }>;
    const payload = readApiErrorPayload(axiosErr.response?.data);
    const status = axiosErr.response?.status;

    return {
      message:
        payload.message ||
        axiosErr.message ||
        (status ? `Request failed with status ${status}` : 'Network request failed'),
      code: payload.code || axiosErr.code,
      status,
      details: payload.details ?? axiosErr.response?.data,
      stack: axiosErr.stack,
      isNetworkError: !axiosErr.response,
      original: err,
    };
  }

  if (err instanceof Error) {
    return {
      message: err.message || 'Unknown error',
      code: err.name !== 'Error' ? err.name : undefined,
      stack: err.stack,
      isNetworkError: false,
      original: err,
    };
  }

  if (typeof err === 'string') {
    return {
      message: err,
      isNetworkError: false,
      original: err,
    };
  }

  return {
    message: 'An unexpected error occurred',
    isNetworkError: false,
    original: err,
  };
}

export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  return normalizeError(err).message || fallback;
}

function formatContextLines(context?: ClientErrorContext): string[] {
  if (!context) return [];

  const lines: string[] = [];
  const entries: Array<[string, unknown]> = [
    ['Source', context.source],
    ['Action', context.action],
    ['Method', context.method],
    ['URL', context.url],
    ['Status', context.status],
    ['Component', context.component],
  ];

  for (const [label, value] of entries) {
    if (value !== undefined && value !== null && value !== '') {
      lines.push(`${label}: ${String(value)}`);
    }
  }

  const knownKeys = new Set(['source', 'action', 'method', 'url', 'status', 'component']);

  for (const [key, value] of Object.entries(context)) {
    if (!knownKeys.has(key) && value !== undefined && value !== null) {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }

  return lines;
}

export function logError(err: unknown, context?: ClientErrorContext): NormalizedClientError {
  const normalized = normalizeError(err);
  const source = (context?.source || 'unknown').toUpperCase();
  const isWarning = normalized.status !== undefined && normalized.status < 500;
  const title = `[${source}] ${context?.action || normalized.message}`;
  const style = isWarning
    ? 'color: #d97706; font-weight: bold; font-size: 12px;'
    : 'color: #dc2626; font-weight: bold; font-size: 12px;';

  console.groupCollapsed(`%c✖ ${title}`, style);
  console.error('Message:', normalized.message);

  if (normalized.code) console.error('Code:', normalized.code);
  if (normalized.status) console.error('HTTP Status:', normalized.status);
  if (normalized.isNetworkError) console.error('Network Error: yes');

  const contextLines = formatContextLines(context);
  if (contextLines.length > 0) {
    console.error('Context:', Object.fromEntries(contextLines.map((line) => line.split(': '))));
  }

  if (normalized.details) {
    console.error('Details:', normalized.details);
  }

  if (normalized.stack) {
    console.error('Stack:', normalized.stack);
  } else if (normalized.original) {
    console.error('Original:', normalized.original);
  }

  console.groupEnd();

  return normalized;
}

export function setupGlobalErrorHandlers(): void {
  window.addEventListener('error', (event) => {
    logError(event.error || event.message, {
      source: 'global',
      action: 'Uncaught error',
      component: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason, {
      source: 'global',
      action: 'Unhandled promise rejection',
    });
  });
}
