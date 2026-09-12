import prisma from '../../config/database';
import { Prisma } from '@prisma/client';

export type InboundPipelineStage = 'flow' | 'static' | 'ai';

export interface InboundPipelineState {
  flow?: boolean;
  flowHandled?: boolean;
  static?: boolean;
  ai?: boolean;
}

function readPipeline(metadata: unknown): InboundPipelineState {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const pipeline = (metadata as Record<string, unknown>).inboundPipeline;
  if (!pipeline || typeof pipeline !== 'object' || Array.isArray(pipeline)) return {};
  return pipeline as InboundPipelineState;
}

export async function getInboundPipeline(messageId: string): Promise<InboundPipelineState> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { metadata: true },
  });
  return readPipeline(message?.metadata);
}

function nextMetadata(metadata: unknown, pipeline: InboundPipelineState): Prisma.InputJsonValue {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>), inboundPipeline: pipeline } as unknown as Prisma.InputJsonValue;
  }
  return { inboundPipeline: pipeline } as unknown as Prisma.InputJsonValue;
}

export async function markInboundPipelineStage(
  messageId: string,
  patch: InboundPipelineState
): Promise<void> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { metadata: true },
  });
  if (!message) return;
  const current = readPipeline(message.metadata);
  await prisma.message.update({
    where: { id: messageId },
    data: { metadata: nextMetadata(message.metadata, { ...current, ...patch }) },
  });
}

/** Returns true only for the first caller. Crash after claim can skip a retry — duplicate Meta sends are worse. */
export async function claimInboundPipelineStage(
  messageId: string,
  stage: InboundPipelineStage
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ metadata: Prisma.JsonValue | null }>>`
      SELECT metadata FROM messages WHERE id = ${messageId} FOR UPDATE
    `;
    if (!rows[0]) return false;
    const current = readPipeline(rows[0].metadata);
    if (current[stage] === true) return false;
    const next = { ...current, [stage]: true };
    await tx.message.update({
      where: { id: messageId },
      data: { metadata: nextMetadata(rows[0].metadata, next) },
    });
    return true;
  });
}

export async function releaseInboundPipelineStage(
  messageId: string,
  stage: InboundPipelineStage
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ metadata: Prisma.JsonValue | null }>>`
      SELECT metadata FROM messages WHERE id = ${messageId} FOR UPDATE
    `;
    if (!rows[0]) return;
    const current = readPipeline(rows[0].metadata);
    if (current[stage] !== true) return;
    const next = { ...current, [stage]: false };
    await tx.message.update({
      where: { id: messageId },
      data: { metadata: nextMetadata(rows[0].metadata, next) },
    });
  });
}

export function isInboundStageComplete(
  pipeline: InboundPipelineState,
  stage: InboundPipelineStage
): boolean {
  return pipeline[stage] === true;
}
