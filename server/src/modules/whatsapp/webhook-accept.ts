import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { webhookQueue } from '../../config/queues';
import { encrypt, decrypt } from '../../utils/crypto';
import { createModuleLogger } from '../../utils/logger';
import { isValidBullMqJobId } from '../campaigns/worker-safety';
import { hashWebhookPayload, providerPhoneNumberId } from './webhook-dispatcher';

const log = createModuleLogger('webhook-accept');

export function collectWebhookPhoneNumberIds(payload: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  for (const entry of (payload.entry as Array<Record<string, unknown>>) || []) {
    for (const change of (entry.changes as Array<Record<string, unknown>>) || []) {
      const value = change.value;
      if (!value || typeof value !== 'object') continue;
      const found = providerPhoneNumberId(value as Record<string, unknown>);
      if (found.phoneNumberId) ids.add(found.phoneNumberId);
    }
  }
  return [...ids];
}

export function inboundWebhookEnvelopeKey(payload: Record<string, unknown>): string {
  return `envelope_${hashWebhookPayload(payload)}`;
}

export function inboundWebhookJobId(eventKey: string, suffix = ''): string {
  const jobId = `${eventKey}${suffix}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  if (!isValidBullMqJobId(jobId)) {
    throw new Error(`Invalid webhook job id: ${jobId}`);
  }
  return jobId;
}

function isDuplicateBullJob(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already exists/i.test(message);
}

async function resolveEnvelopeOrg(phoneNumberIds: string[]) {
  for (const phoneNumberId of phoneNumberIds) {
    const number = await prisma.whatsappNumber.findFirst({
      where: { phoneNumberId, isActive: true },
      select: { id: true, organizationId: true },
    });
    if (number) return number;
  }
  return null;
}

async function persistEnvelope(params: {
  organizationId: string;
  eventKey: string;
  requestId: string;
  phoneNumberIds: string[];
  payload: Record<string, unknown>;
}): Promise<'created' | 'duplicate'> {
  try {
    await prisma.providerWebhookEvent.create({
      data: {
        organizationId: params.organizationId,
        eventKey: params.eventKey,
        field: 'envelope',
        status: 'RECEIVED',
        claimedAt: new Date(),
        payloadCiphertext: encrypt(JSON.stringify(params.payload)),
        requestId: params.requestId,
        phoneNumberId: params.phoneNumberIds.join(',') || null,
      },
    });
    return 'created';
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return 'duplicate';
    }
    throw error;
  }
}

async function enqueueEnvelope(params: {
  payload: Record<string, unknown>;
  requestId: string;
  eventKey: string;
  organizationId: string | null;
  jobId: string;
}): Promise<'queued' | 'duplicate'> {
  try {
    await webhookQueue.add(
      'process-webhook',
      {
        payload: params.payload,
        requestId: params.requestId,
        eventKey: params.eventKey,
        organizationId: params.organizationId,
      },
      { jobId: params.jobId, attempts: 4 }
    );
    return 'queued';
  } catch (error) {
    if (isDuplicateBullJob(error)) return 'duplicate';
    throw error;
  }
}

/** Persist ciphertext, then enqueue. Caller acks Meta only after this resolves.
 * ponytail: ciphertext uses app ENCRYPTION_KEY, not KMS — swap if compliance needs it. */
export async function persistAndEnqueueInboundWebhook(params: {
  payload: Record<string, unknown>;
  requestId: string;
}): Promise<{
  eventKey: string;
  organizationId: string | null;
  persist: 'created' | 'duplicate' | 'skipped';
  queue: 'queued' | 'duplicate';
}> {
  const eventKey = inboundWebhookEnvelopeKey(params.payload);
  const jobId = inboundWebhookJobId(eventKey);
  const phoneNumberIds = collectWebhookPhoneNumberIds(params.payload);
  const routed = await resolveEnvelopeOrg(phoneNumberIds);

  let persist: 'created' | 'duplicate' | 'skipped' = 'skipped';
  if (routed) {
    persist = await persistEnvelope({
      organizationId: routed.organizationId,
      eventKey,
      requestId: params.requestId,
      phoneNumberIds,
      payload: params.payload,
    });
  }

  const queue = await enqueueEnvelope({
    payload: params.payload,
    requestId: params.requestId,
    eventKey,
    organizationId: routed?.organizationId ?? null,
    jobId,
  });

  return {
    eventKey,
    organizationId: routed?.organizationId ?? null,
    persist,
    queue,
  };
}

export async function replayInboundWebhookEnvelope(params: {
  organizationId: string;
  eventKey: string;
  actorUserId: string;
}): Promise<{ eventKey: string; jobId: string }> {
  const row = await prisma.providerWebhookEvent.findUnique({
    where: {
      organizationId_eventKey: {
        organizationId: params.organizationId,
        eventKey: params.eventKey,
      },
    },
    select: { payloadCiphertext: true, requestId: true },
  });
  if (!row?.payloadCiphertext) {
    const err = new Error('Webhook envelope not found');
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  const payload = JSON.parse(decrypt(row.payloadCiphertext)) as Record<string, unknown>;
  const jobId = inboundWebhookJobId(params.eventKey, `_replay_${Date.now()}`);
  await enqueueEnvelope({
    payload,
    requestId: row.requestId || `replay_${params.eventKey}`,
    eventKey: params.eventKey,
    organizationId: params.organizationId,
    jobId,
  });
  log.info('Operator replayed inbound webhook envelope', {
    organizationId: params.organizationId,
    eventKey: params.eventKey,
    actorUserId: params.actorUserId,
    jobId,
  });
  return { eventKey: params.eventKey, jobId };
}

export async function completeInboundWebhookEnvelope(
  organizationId: string,
  eventKey: string
): Promise<void> {
  await prisma.providerWebhookEvent.updateMany({
    where: {
      organizationId,
      eventKey,
      status: { in: ['RECEIVED', 'PROCESSING'] },
    },
    data: { status: 'COMPLETED', processedAt: new Date() },
  });
}

export async function oldestWebhookWaitingMs(nowMs = Date.now()): Promise<number | null> {
  const row = await prisma.providerWebhookEvent.findFirst({
    where: { status: { in: ['RECEIVED', 'PROCESSING'] } },
    orderBy: { claimedAt: 'asc' },
    select: { claimedAt: true },
  });
  if (!row) return null;
  return Math.max(0, nowMs - row.claimedAt.getTime());
}
