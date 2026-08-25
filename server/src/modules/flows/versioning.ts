import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import type { FlowNode } from './types';
import { AppError } from '../../utils/response';
import { validateFlowGraph } from './validation';

export async function saveFlowVersion(
  flowId: string,
  nodes: FlowNode[],
  triggerType: string,
  triggerConfig: Record<string, unknown>,
  note?: string,
  startNodeId?: string | null
) {
  const flow = await prisma.flow.findUnique({ where: { id: flowId } });
  if (!flow) return null;

  const nextVersion = flow.version + 1;

  await prisma.$transaction([
    prisma.flowVersion.create({
      data: {
        flowId,
        version: nextVersion,
        nodes: nodes as unknown as Prisma.InputJsonValue,
        triggerType: triggerType as never,
        triggerConfig: triggerConfig as Prisma.InputJsonValue,
        startNodeId,
        note,
      },
    }),
    prisma.flow.update({
      where: { id: flowId },
      data: {
        version: nextVersion,
        status: 'PUBLISHED',
        nodes: nodes as unknown as Prisma.InputJsonValue,
        draftNodes: Prisma.JsonNull,
      },
    }),
  ]);

  return nextVersion;
}

export async function saveFlowDraft(
  flowId: string,
  organizationId: string,
  draft: {
    nodes: FlowNode[];
    name?: string;
    description?: string | null;
    triggerType?: string;
    triggerConfig?: Record<string, unknown>;
    startNodeId?: string;
    enabled?: boolean;
    priority?: number;
  }
) {
  return prisma.flow.updateMany({
    where: { id: flowId, organizationId },
    data: {
      status: 'DRAFT',
      draftNodes: draft.nodes as unknown as Prisma.InputJsonValue,
      ...(draft.name !== undefined ? { name: draft.name } : {}),
      ...(draft.description !== undefined ? { description: draft.description } : {}),
      ...(draft.triggerType ? { triggerType: draft.triggerType as never } : {}),
      ...(draft.triggerConfig ? { triggerConfig: draft.triggerConfig as Prisma.InputJsonValue } : {}),
      ...(draft.startNodeId !== undefined ? { startNodeId: draft.startNodeId } : {}),
      ...(draft.enabled !== undefined ? { enabled: draft.enabled } : {}),
      ...(draft.priority !== undefined ? { priority: draft.priority } : {}),
    },
  });
}

export async function publishFlowDraft(flowId: string, organizationId: string, note?: string) {
  const flow = await prisma.flow.findFirst({ where: { id: flowId, organizationId } });
  if (!flow || !flow.draftNodes) return null;

  const nodes = flow.draftNodes as unknown as FlowNode[];
  return saveFlowVersion(
    flowId,
    nodes,
    flow.triggerType,
    flow.triggerConfig as Record<string, unknown>,
    note,
    flow.startNodeId
  );
}

export async function getFlowVersions(flowId: string, organizationId: string) {
  const flow = await prisma.flow.findFirst({ where: { id: flowId, organizationId } });
  if (!flow) return null;

  return prisma.flowVersion.findMany({
    where: { flowId },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, note: true, createdAt: true, triggerType: true },
  });
}

export async function restoreFlowVersion(flowId: string, organizationId: string, version: number) {
  const flow = await prisma.flow.findFirst({ where: { id: flowId, organizationId } });
  const ver = await prisma.flowVersion.findUnique({ where: { flowId_version: { flowId, version } } });
  if (!flow || !ver) return null;

  const nodes = Array.isArray(ver.nodes) ? (ver.nodes as unknown as FlowNode[]) : [];
  const startNodeId = ver.startNodeId || nodes[0]?.id;
  const validation = validateFlowGraph(
    nodes,
    ver.triggerType,
    ver.triggerConfig as Record<string, unknown>,
    startNodeId
  );
  if (!validation.valid) {
    throw new AppError(400, `Cannot restore invalid flow version: ${validation.errors.join('; ')}`);
  }

  await prisma.flow.update({
    where: { id: flowId },
    data: {
      draftNodes: nodes as unknown as Prisma.InputJsonValue,
      triggerType: ver.triggerType,
      triggerConfig: ver.triggerConfig as Prisma.InputJsonValue,
      startNodeId,
      status: 'DRAFT',
    },
  });

  return { ...ver, startNodeId };
}
