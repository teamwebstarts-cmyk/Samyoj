import { AppError, logError } from './index';

export interface MetaErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_data?: { messaging_product?: string; details?: string };
    fbtrace_id?: string;
  };
}

const NON_RETRYABLE = new Set([
  100, 190, 368, 131008, 131021, 131026, 131031, 131037, 131047, 131049, 131050, 131051,
  132000, 132001, 132012, 132015, 132016, 141006, 141010, 141014,
]);
const RETRYABLE_4X = new Set([130429, 131056, 80007]);
const RETRYABLE_2X = new Set([4, 131000, 131016, 131057]);
const QUALITY_AFFECTING = new Set([368, 131031, 130497, 131048, 131049, 131064, 132015, 132016]);

export type MetaBackoff = 'none' | '2x' | '4x' | 'reauth';

export interface ClassifiedMetaError {
  retryable: boolean;
  backoff: MetaBackoff;
  affectsQuality: boolean;
  userFacingMessage: string;
  code: number;
  details?: string;
  fbtraceId?: string;
}

export function classifyMetaError(body: MetaErrorResponse): ClassifiedMetaError {
  const err = body.error;
  if (!err) {
    return {
      retryable: false,
      backoff: 'none',
      affectsQuality: false,
      userFacingMessage: 'Unknown Meta error',
      code: 0,
    };
  }

  const code = err.code ?? 0;
  let backoff: MetaBackoff = 'none';
  if (RETRYABLE_4X.has(code)) backoff = '4x';
  else if (RETRYABLE_2X.has(code)) backoff = '2x';
  else if ([0, 190, 200].includes(code)) backoff = 'reauth';

  return {
    retryable: !NON_RETRYABLE.has(code),
    backoff,
    affectsQuality: QUALITY_AFFECTING.has(code),
    userFacingMessage: err.message ?? 'Unknown Meta error',
    code,
    details: err.error_data?.details,
    fbtraceId: err.fbtrace_id,
  };
}

/** Meta-mandated 4^X backoff delay in ms (1s, 4s, 16s, 64s, …). */
export function metaBackoffDelayMs(backoff: MetaBackoff, attempt: number): number {
  if (backoff === '4x') return Math.pow(4, Math.max(attempt - 1, 0)) * 1000;
  if (backoff === '2x') return Math.pow(2, Math.max(attempt - 1, 0)) * 1000;
  return 0;
}

export function handleSendError(body: MetaErrorResponse, jobId: string): never {
  const classified = classifyMetaError(body);
  logError(new AppError(classified.retryable ? 502 : 400, classified.userFacingMessage, `META_${classified.code}`), {
    source: 'worker',
    queueName: 'message-send',
    jobId,
    code: classified.code,
    affectsQuality: classified.affectsQuality,
    backoff: classified.backoff,
  });
  if (!classified.retryable) {
    throw new AppError(400, classified.userFacingMessage, `META_${classified.code}`);
  }
  throw new AppError(502, classified.userFacingMessage, `META_RETRY_${classified.code}`);
}
