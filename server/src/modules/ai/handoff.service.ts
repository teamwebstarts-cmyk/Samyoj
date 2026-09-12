import prisma from '../../config/database';
import { emitToOrg } from '../../realtime';
import { createModuleLogger } from '../../utils/logger';
import { pickAgentForHandoff as pickAgent } from '../team/assignment';

const log = createModuleLogger('ai-handoff');

export async function pickAgentForHandoff(
  organizationId: string,
  whatsappNumberId?: string | null
): Promise<string | null> {
  return pickAgent(organizationId, undefined, whatsappNumberId);
}

export async function assignAgentOnHandoff(
  organizationId: string,
  conversationId: string
): Promise<{ id: string; name: string } | null> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId },
    select: { assignedAgentId: true, whatsappNumberId: true },
  });
  if (!conversation) return null;
  if (conversation.assignedAgentId) {
    const existing = await prisma.user.findUnique({
      where: { id: conversation.assignedAgentId },
      select: { id: true, name: true },
    });
    return existing;
  }

  const agentId = await pickAgentForHandoff(organizationId, conversation.whatsappNumberId);
  if (!agentId) return null;

  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true, name: true },
  });
  if (!agent) return null;

  const claimed = await prisma.conversation.updateMany({
    where: { id: conversationId, organizationId, assignedAgentId: null },
    data: { assignedAgentId: agent.id },
  });
  if (claimed.count !== 1) {
    const winner = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      select: { assignedAgentId: true },
    });
    if (!winner?.assignedAgentId) return null;
    return prisma.user.findUnique({
      where: { id: winner.assignedAgentId },
      select: { id: true, name: true },
    });
  }

  emitToOrg(organizationId, 'conversation:assigned', {
    conversationId,
    assignedAgent: { id: agent.id, name: agent.name },
    ...(conversation.whatsappNumberId ? { whatsappNumberId: conversation.whatsappNumberId } : {}),
  });

  log.info('Agent assigned on handoff', { conversationId, agentId: agent.id });
  return { id: agent.id, name: agent.name };
}
