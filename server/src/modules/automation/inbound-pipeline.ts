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
  const next = { ...current, ...patch };
  const metadata =
    message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
      ? { ...(message.metadata as Record<string, unknown>), inboundPipeline: next }
      : { inboundPipeline: next };
  await prisma.message.update({
    where: { id: messageId },
    data: { metadata: metadata as Prisma.InputJsonValue },
  });
}

export function isInboundStageComplete(
  pipeline: InboundPipelineState,
  stage: InboundPipelineStage
): boolean {
  return pipeline[stage] === true;
}
