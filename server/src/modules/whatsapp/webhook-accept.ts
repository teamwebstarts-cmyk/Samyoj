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

async function resolveMetaChannelOrg(payload: Record<string, unknown>) {
  const platform = payload.object === 'instagram' ? 'IG' : payload.object === 'page' ? 'FB' : null;
  if (!platform) return null;
  const ids = new Set<string>();
  for (const entry of (payload.entry as Array<Record<string, unknown>>) || []) {
    if (typeof entry.id === 'string') ids.add(entry.id);
    for (const change of (entry.changes as Array<Record<string, unknown>>) || []) {
      const value = change.value;
      if (!value || typeof value !== 'object') continue;
      const row = value as Record<string, unknown>;
      for (const key of ['page_id', 'instagram_business_account', 'id']) {
        if (typeof row[key] === 'string') ids.add(row[key] as string);
      }
    }
  }
  if (!ids.size) return null;
  const channels = await prisma.channel.findMany({
    where: { platform, platformAccountId: { in: [...ids] }, isActive: true },
    select: { organizationId: true },
    take: 20,
  });
  const organizations = new Set(channels.map((channel) => channel.organizationId));
  return organizations.size === 1 ? { organizationId: [...organizations][0] } : null;
}

// A payload whose ciphertext could exceed the btree limit (~2.7 KB index row)
// is persisted as an oversize tombstone and ACKed, never retried.
const MAX_PERSIST_BYTES = 512 * 1024;

function isIndexRowOverflow(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === '54000' ||
      /exceeds btree|Values larger than 1\/3 of a buffer page/i.test(error.message))
  );
}

export type EnvelopePersist = 'created' | 'duplicate' | 'skipped' | 'oversize';

/** Persist the envelope; oversize payloads become small COMPLETED tombstones. */
async function persistEnvelope(params: {
  organizationId: string;
  eventKey: string;
  requestId: string;
  phoneNumberIds: string[];
  payload: Record<string, unknown>;
}): Promise<EnvelopePersist> {
  const ciphertext = encrypt(JSON.stringify(params.payload));
  // Oversize check before the insert: the unique index spans the row, so a
  // giant ciphertext is a guaranteed 54000 poison pill. Store a tombstone
  // instead (small, still proves the event arrived) and ACK.
  if (ciphertext.length > MAX_PERSIST_BYTES) {
    log.warn('Webhook envelope oversize; persisting tombstone', {
      ciphertextBytes: ciphertext.length,
      eventKey: params.eventKey,
    });
    try {
      await prisma.providerWebhookEvent.create({
        data: {
          organizationId: params.organizationId,
          eventKey: params.eventKey,
          field: 'envelope',
          status: 'COMPLETED',
          claimedAt: new Date(),
          processedAt: new Date(),
          payloadCiphertext: `oversize:${ciphertext.length}`,
          requestId: params.requestId,
          phoneNumberId: params.phoneNumberIds.join(',') || null,
        },
      });
      return 'oversize';
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return 'duplicate';
      }
      // Tombstone itself too big must never happen; treat like duplicate-safe skip.
      log.error('Oversize tombstone insert failed', { error: String(error) });
      return 'oversize';
    }
  }
  try {
    await prisma.providerWebhookEvent.create({
      data: {
        organizationId: params.organizationId,
        eventKey: params.eventKey,
        field: 'envelope',
        status: 'RECEIVED',
        claimedAt: new Date(),
        payloadCiphertext: ciphertext,
        requestId: params.requestId,
        phoneNumberId: params.phoneNumberIds.join(',') || null,
      },
    });
    return 'created';
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return 'duplicate';
    }
    if (isIndexRowOverflow(error)) {
      log.error('Webhook envelope hit index row limit; persisting tombstone', {
        eventKey: params.eventKey,
        error: error instanceof Error ? error.message.slice(0, 200) : String(error),
      });
      await prisma.providerWebhookEvent
        .create({
          data: {
            organizationId: params.organizationId,
            eventKey: params.eventKey,
            field: 'envelope',
            status: 'COMPLETED',
            claimedAt: new Date(),
            processedAt: new Date(),
            payloadCiphertext: `oversize:${ciphertext.length}`,
            requestId: params.requestId,
            phoneNumberId: params.phoneNumberIds.join(',') || null,
          },
        })
        .catch((tombstoneError) => {
          if (
            !(
              tombstoneError instanceof Prisma.PrismaClientKnownRequestError &&
              tombstoneError.code === 'P2002'
            )
          ) {
            log.error('Tombstone insert failed after overflow', { error: String(tombstoneError) });
          }
        });
      return 'oversize';
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
      // Queue defaults carry attempts/backoff/removeOnFail; the jobId keeps
      // Meta's redeliveries deduplicated.
      { jobId: params.jobId }
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
  persist: EnvelopePersist;
  queue: 'queued' | 'duplicate';
}> {
  const eventKey = inboundWebhookEnvelopeKey(params.payload);
  const jobId = inboundWebhookJobId(eventKey);
  const phoneNumberIds = collectWebhookPhoneNumberIds(params.payload);
  const routed =
    (await resolveEnvelopeOrg(phoneNumberIds)) || (await resolveMetaChannelOrg(params.payload));

  let persist: EnvelopePersist = 'skipped';
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

/**
 * Reclaim envelopes that never completed. A row stuck RECEIVED/PROCESSING past
 * this window is a crash or a poison payload; mark it ABANDONED so
 * oldestWebhookWaitingMs() reflects only genuinely waiting work.
 */
const STALE_ENVELOPE_MS = 60 * 60 * 1000;

export async function abandonStaleWebhookEnvelopes(nowMs = Date.now()): Promise<number> {
  const cutoff = new Date(nowMs - STALE_ENVELOPE_MS);
  const result = await prisma.providerWebhookEvent.updateMany({
    where: {
      status: { in: ['RECEIVED', 'PROCESSING'] },
      claimedAt: { lt: cutoff },
    },
    data: { status: 'ABANDONED', processedAt: new Date() },
  });
  if (result.count > 0) {
    log.warn('Abandoned stale webhook envelopes', { count: result.count, olderThan: cutoff.toISOString() });
  }
  return result.count;
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
