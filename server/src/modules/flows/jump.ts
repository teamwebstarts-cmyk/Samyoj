import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { cancelFlowDelayJob } from './pause-automation';
import type { FlowNode, FlowState } from './types';
import { extractAbSticky } from './ab-sticky';

function parseNodes(raw: unknown): FlowNode[] {
  return Array.isArray(raw) ? (raw as FlowNode[]) : [];
}

function findNode(nodes: FlowNode[], nodeId: string): FlowNode | undefined {
  return nodes.find((n) => n.id === nodeId);
}

function waitingForNodeType(type: string): FlowState['waitingFor'] {
  if (type === 'buttons' || type === 'list') return 'button';
  if (type === 'question') return 'text';
  if (type === 'wa_flow') return 'wa_flow';
  return null;
}

export async function jumpConversationToFlowNode(params: {
  organizationId: string;
  whatsappNumberId: string;
  conversationId: string;
  nodeId: string;
}): Promise<{ flowId: string; nodeId: string; waitingFor: string | null }> {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: params.conversationId,
      organizationId: params.organizationId,
      whatsappNumberId: params.whatsappNumberId,
    },
    select: { id: true, botState: true },
  });
  if (!conversation) throw new AppError(404, 'Conversation not found');

  const current = (conversation.botState || {}) as Record<string, unknown>;
  const flowId = current.flowId as string | undefined;
  if (!flowId) {
    throw new AppError(400, 'This chat is not in an active conversation flow');
  }

  const flow = await prisma.flow.findFirst({
    where: {
      id: flowId,
      organizationId: params.organizationId,
      whatsappNumberId: params.whatsappNumberId,
      enabled: true,
      status: 'PUBLISHED',
    },
    select: { nodes: true, name: true },
  });
  if (!flow) throw new AppError(404, 'Published flow not found for this chat');

  const nodes = parseNodes(flow.nodes);
  const target = findNode(nodes, params.nodeId);
  if (!target) {
    throw new AppError(400, 'That step does not exist in the active flow');
  }

  await cancelFlowDelayJob(params.conversationId);

  const sticky = extractAbSticky(conversation.botState);
  const waitingFor = waitingForNodeType(target.type);
  const nextState: FlowState = {
    flowId,
    currentNodeId: target.id,
    waitingFor,
    variables: (current.variables as Record<string, string>) || {},
    attempts: 0,
    resumeAt: undefined,
    ...(Object.keys(sticky).length ? { abSticky: sticky } : {}),
  };

  await prisma.conversation.update({
    where: { id: params.conversationId },
    data: { botState: nextState as unknown as Prisma.InputJsonValue },
  });

  return { flowId, nodeId: target.id, waitingFor };
}
