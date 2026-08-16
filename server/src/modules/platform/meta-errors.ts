import {
  type PlatformMetaErrorCategory,
  type PrismaClient,
} from '@prisma/client';
import prisma from '../../config/database';
import { redactText } from '../../utils/pii-redaction';
import { createModuleLogger } from '../../utils/logger';
import { extractMetaErrorFields } from '../whatsapp/meta.service';
import { utcDay } from './privacy';

const log = createModuleLogger('platform-meta-errors');

const OFFICIAL_TITLES: Record<number, string> = {
  130429: 'Throughput limit reached',
  131026: 'Message undeliverable',
  131047: 'Re-engagement required',
  131048: 'Spam rate / quality limit',
  131049: 'Marketing message cap',
  131051: 'Unsupported message type',
  131053: 'Media download error',
  131056: 'Pair rate limit',
};

const IDENTIFIER_PATTERN = /\b(wa_id|wamid|fbtrace_id)\b[=: ]*[A-Za-z0-9._-]+/gi;
type MetaErrorDatabase = Pick<PrismaClient, 'metaErrorStat'>;

export function officialMetaErrorTitle(code: number): string {
  return OFFICIAL_TITLES[code] || `Meta error ${code}`;
}

export function redactMetaErrorTitle(raw: string | null | undefined, code?: number): string {
  const official = code !== undefined ? officialMetaErrorTitle(code) : null;
  if (!raw) return official || 'Meta error';
  const cleaned = redactText(raw)
    .replace(IDENTIFIER_PATTERN, '[REDACTED]')
    .replace(/\bwamid\.[A-Za-z0-9._~-]+/gi, '[REDACTED]')
    .replace(/https?:\/\/\S+/gi, '[REDACTED_URL]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  if (!cleaned || cleaned === '[REDACTED]') return official || 'Meta error';
  return cleaned;
}

export function metaErrorScopeKey(whatsappNumberId?: string | null): string {
  return whatsappNumberId || 'org';
}

export function metaErrorCategory(code: number): PlatformMetaErrorCategory {
  if (code === 190) return 'AUTHENTICATION';
  if ([4, 80007, 130429, 131016, 131056, 131057].includes(code)) return 'RATE_LIMIT';
  if (code === 131047) return 'SERVICE_WINDOW';
  if ([131048, 131049, 131050, 131051].includes(code)) return 'POLICY';
  if ([132000, 132001, 132005, 132007, 132008, 132012, 132015, 132016].includes(code)) {
    return 'TEMPLATE';
  }
  if ([131021, 131026, 131037, 131053].includes(code)) return 'DELIVERY';
  return 'UNKNOWN';
}

export type MetaErrorStatInput = {
  organizationId: string;
  whatsappNumberId?: string | null;
  code?: number | null;
  sampleTitle?: string | null;
  at?: Date;
};

export async function recordMetaErrorStat(
  input: MetaErrorStatInput,
  database: MetaErrorDatabase = prisma
): Promise<void> {
  if (!input.organizationId || input.code == null || !Number.isFinite(input.code)) return;

  const code = Math.trunc(input.code);
  const scopeKey = metaErrorScopeKey(input.whatsappNumberId);
  const lastAt = input.at ?? new Date();
  const bucketDate = utcDay(lastAt);
  // Provider strings can include names and identifiers in formats that no
  // regex can exhaustively recognize. Persist a server-owned title only.
  const sampleTitle = officialMetaErrorTitle(code);
  const numberId = input.whatsappNumberId || null;
  const category = metaErrorCategory(code);

  await database.metaErrorStat.upsert({
    where: {
      organizationId_scopeKey_code_bucketDate: {
        organizationId: input.organizationId,
        scopeKey,
        code,
        bucketDate,
      },
    },
    create: {
      organizationId: input.organizationId,
      whatsappNumberId: numberId,
      scopeKey,
      code,
      category,
      count: 1,
      sampleTitle,
      bucketDate,
      lastAt,
    },
    update: {
      category,
      count: { increment: 1 },
      sampleTitle,
      lastAt,
    },
  });
}

export function emitMetaErrorStat(
  input: MetaErrorStatInput,
  database: MetaErrorDatabase = prisma
): void {
  if (!input.organizationId || input.code == null) return;
  void recordMetaErrorStat(input, database).catch(() => {
    log.warn('Failed to record Meta error aggregate', {
      organizationId: input.organizationId,
      code: input.code,
      numberScoped: Boolean(input.whatsappNumberId),
    });
  });
}

export function safeRecordMetaSendFailure(input: {
  organizationId?: string | null;
  whatsappNumberId?: string | null;
  error: unknown;
}): void {
  if (!input.organizationId) return;
  const { metaCode, message } = extractMetaErrorFields(input.error);
  emitMetaErrorStat({
    organizationId: input.organizationId,
    whatsappNumberId: input.whatsappNumberId,
    code: metaCode,
    sampleTitle: message,
  });
}
