import winston from 'winston';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'cyan',
    debug: 'gray',
  },
};

winston.addColors(customLevels.colors);

function buildDevFormat() {
  return winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const lines: string[] = [`${timestamp} ${level}: ${message}`];

    const context = meta.context as Record<string, unknown> | undefined;
    const error = meta.error as Record<string, unknown> | undefined;
    const rest = { ...meta };
    delete rest.context;
    delete rest.error;
    delete rest.service;
    delete rest.module;

    if (context && Object.keys(context).length > 0) {
      lines.push(`  Context: ${JSON.stringify(context, null, 2).replace(/\n/g, '\n  ')}`);
    }

    if (error && Object.keys(error).length > 0) {
      lines.push(`  Error: ${JSON.stringify(error, null, 2).replace(/\n/g, '\n  ')}`);
    }

    const extraKeys = Object.keys(rest).filter((k) => rest[k] !== undefined);
    if (extraKeys.length > 0) {
      const extra: Record<string, unknown> = {};
      for (const key of extraKeys) extra[key] = rest[key];
      lines.push(`  Meta: ${JSON.stringify(extra, null, 2).replace(/\n/g, '\n  ')}`);
    }

    if (stack) {
      lines.push(`  Stack:\n  ${String(stack).split('\n').slice(1).join('\n  ')}`);
    }

    return lines.join('\n');
  });
}

function createBaseLogger(service: string) {
  const isProd = config.nodeEnv === 'production';

  return winston.createLogger({
    levels: customLevels.levels,
    level: config.logLevel,
    defaultMeta: { service },
    transports: [
      new winston.transports.Console({
        format: isProd
          ? winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.json()
            )
          : winston.format.combine(
              winston.format.colorize({ all: true }),
              winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
              winston.format.errors({ stack: true }),
              buildDevFormat()
            ),
      }),
    ],
    exitOnError: false,
  });
}

export const logger = createBaseLogger('whatsapp-api');

export function createModuleLogger(module: string) {
  return logger.child({ module });
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'http';

    logger.log(level, `${req.method} ${req.originalUrl} ${status} ${durationMs}ms`, {
      source: 'http',
      method: req.method,
      path: req.originalUrl,
      status,
      durationMs,
      userId: req.user?.userId,
      organizationId: req.user?.organizationId,
    });
  });

  next();
}

export default logger;
