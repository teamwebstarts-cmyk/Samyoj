import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import type { Worker } from 'bullmq';
import logger from '../utils/logger';

export type ErrorSource =
  | 'api'
  | 'worker'
  | 'webhook'
  | 'socket'
  | 'startup'
  | 'database'
  | 'external'
  | 'media'
  | 'process';

export interface ErrorContext {
  source?: ErrorSource;
  method?: string;
  path?: string;
  userId?: string;
  organizationId?: string;
  jobId?: string;
  queueName?: string;
  statusCode?: number;
  [key: string]: unknown;
}

export interface NormalizedError {
  message: string;
  code?: string;
  statusCode: number;
  stack?: string;
  isOperational: boolean;
  details?: unknown;
  original?: unknown;
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public context?: ErrorContext,
    public isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

function getPrismaError(err: Prisma.PrismaClientKnownRequestError): NormalizedError {
  switch (err.code) {
    case 'P2002':
      return {
        message: 'A record with this value already exists',
        code: 'DUPLICATE_RECORD',
        statusCode: 409,
        stack: err.stack,
        isOperational: true,
        details: err.meta,
      };
    case 'P2025':
      return {
        message: 'Record not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        stack: err.stack,
        isOperational: true,
        details: err.meta,
      };
    default:
      return {
        message: `Database error (${err.code})`,
        code: err.code,
        statusCode: 500,
        stack: err.stack,
        isOperational: false,
        details: err.meta,
      };
  }
}

function getZodError(err: ZodError): NormalizedError {
  const issues = err.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));

  return {
    message: issues.map((i) => `${i.path}: ${i.message}`).join('; '),
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    stack: err.stack,
    isOperational: true,
    details: issues,
  };
}

export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof AppError) {
    return {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      stack: err.stack,
      isOperational: err.isOperational,
      original: err,
    };
  }

  if (err instanceof ZodError) {
    return getZodError(err);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return getPrismaError(err);
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      message: 'Invalid database query',
      code: 'DATABASE_VALIDATION_ERROR',
      statusCode: 400,
      stack: err.stack,
      isOperational: true,
      original: err,
    };
  }

  if (err instanceof Error) {
    return {
      message: err.message || 'Unknown error',
      code: err.name !== 'Error' ? err.name : undefined,
      statusCode: 500,
      stack: err.stack,
      isOperational: false,
      original: err,
    };
  }

  if (typeof err === 'string') {
    return {
      message: err,
      statusCode: 500,
      isOperational: false,
      original: err,
    };
  }

  return {
    message: 'An unexpected error occurred',
    statusCode: 500,
    isOperational: false,
    original: err,
  };
}

export function logError(err: unknown, context?: ErrorContext): NormalizedError {
  const normalized = normalizeError(err);
  const source = context?.source?.toUpperCase() || 'UNKNOWN';
  const level = normalized.isOperational && normalized.statusCode < 500 ? 'warn' : 'error';

  logger.log(level, `[${source}] ${normalized.message}`, {
    context,
    error: {
      message: normalized.message,
      code: normalized.code,
      statusCode: normalized.statusCode,
      isOperational: normalized.isOperational,
      details: normalized.details,
    },
    stack: normalized.stack,
  });

  if (!normalized.isOperational || normalized.statusCode >= 500) {
    import('../config/sentry').then(({ captureException }) => {
      captureException(err, context);
    }).catch(() => {});
  }

  return normalized;
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const context: ErrorContext = {
    source: 'api',
    method: req.method,
    path: req.originalUrl || req.path,
    userId: req.user?.userId,
    organizationId: req.user?.organizationId,
  };

  const normalized = logError(err, context);

  return res.status(normalized.statusCode).json({
    success: false,
    error: {
      message: normalized.message,
      code: normalized.code,
      ...(normalized.details ? { details: normalized.details } : {}),
    },
  });
}

export function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (err) => {
    logError(err, { source: 'process', path: 'uncaughtException' });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logError(reason, { source: 'process', path: 'unhandledRejection' });
  });
}

export function attachWorkerErrorHandlers(worker: Worker, queueName: string): void {
  worker.on('failed', (job, err) => {
    logError(err, {
      source: 'worker',
      queueName,
      jobId: job?.id != null ? String(job.id) : undefined,
    });
  });

  worker.on('error', (err) => {
    logError(err, {
      source: 'worker',
      queueName,
      path: 'worker:error',
    });
  });
}
