import { config } from './index';
import { redactPii } from '../utils/pii-redaction';
import logger from '../utils/logger';

let sentryInitialized = false;

export async function initSentry(): Promise<void> {
  const dsn = config.sentry.dsn;
  if (!dsn || sentryInitialized) return;

  try {
    // Dynamic require avoids build failure when @sentry/node is not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node') as {
      init: (opts: Record<string, unknown>) => void;
      withScope: (fn: (scope: { setExtras: (e: Record<string, unknown>) => void }) => void) => void;
      captureException: (err: unknown) => void;
    };

    Sentry.init({
      dsn,
      environment: config.nodeEnv,
      tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
      beforeSend(event: Record<string, unknown>) {
        const req = event.request as Record<string, unknown> | undefined;
        if (req?.headers) req.headers = redactPii(req.headers);
        if (req?.data) req.data = redactPii(req.data);
        if (event.extra) event.extra = redactPii(event.extra);
        return event;
      },
    });
    sentryInitialized = true;
    logger.info('Sentry initialized', { source: 'startup' });
  } catch {
    logger.warn('Sentry SDK not available — install @sentry/node to enable', { source: 'startup' });
  }
}

export async function captureException(err: unknown, context?: Record<string, unknown>): Promise<void> {
  if (!sentryInitialized) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node') as {
      withScope: (fn: (scope: { setExtras: (e: Record<string, unknown>) => void }) => void) => void;
      captureException: (err: unknown) => void;
    };
    Sentry.withScope((scope) => {
      if (context) scope.setExtras(redactPii(context));
      Sentry.captureException(err);
    });
  } catch {
    /* ignore */
  }
}
