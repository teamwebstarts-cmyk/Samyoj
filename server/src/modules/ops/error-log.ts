import fs from 'fs';
import path from 'path';
import winston from 'winston';
import logger from '../../utils/logger';
import { getClientPaths } from '../../config/paths';
import { redactText } from '../../utils/pii-redaction';

const MAX_FILE_BYTES = 2_000_000;

export function opsErrorLogPath(): string {
  if (process.env.OPS_ERROR_LOG) return process.env.OPS_ERROR_LOG;
  const repoRoot = path.resolve(getClientPaths().clientRoot, '..');
  return path.join(repoRoot, '.run', 'logs', 'ops-errors.log');
}

let attached = false;

export function attachOpsErrorFileTransport(): void {
  if (attached) return;
  attached = true;
  const filename = opsErrorLogPath();
  try {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    try {
      fs.chmodSync(path.dirname(filename), 0o750);
    } catch {
      // ignore
    }
    logger.add(
      new winston.transports.File({
        filename,
        level: 'error',
        maxsize: 5 * 1024 * 1024,
        maxFiles: 3,
        tailable: true,
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      })
    );
    try {
      fs.chmodSync(filename, 0o640);
    } catch {
      // file may not exist until first error
    }
  } catch (err) {
    logger.warn('Could not attach ops error log file', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface OpsErrorLine {
  at: string;
  level: string;
  module?: string;
  text: string;
  code?: string;
}

export function readRecentOpsErrors(limit = 50): OpsErrorLine[] {
  const filename = opsErrorLogPath();
  if (!fs.existsSync(filename)) return [];

  try {
    const stat = fs.statSync(filename);
    const start = Math.max(0, stat.size - MAX_FILE_BYTES);
    const fd = fs.openSync(filename, 'r');
    const buf = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n').filter(Boolean);
    const recent = lines.slice(-Math.max(1, Math.min(limit, 200)));
    const parsed: OpsErrorLine[] = [];
    for (const line of recent) {
      try {
        const row = JSON.parse(line) as Record<string, unknown>;
        const text = typeof row.message === 'string' ? row.message : line;
        parsed.push({
          at: typeof row.timestamp === 'string' ? row.timestamp : '',
          level: typeof row.level === 'string' ? row.level : 'error',
          module: typeof row.module === 'string' ? row.module : undefined,
          text: redactText(text).slice(0, 500),
          code:
            typeof (row.error as { code?: string } | undefined)?.code === 'string'
              ? (row.error as { code: string }).code
              : undefined,
        });
      } catch {
        parsed.push({
          at: '',
          level: 'error',
          text: redactText(line).slice(0, 500),
        });
      }
    }
    return parsed;
  } catch {
    return [];
  }
}
