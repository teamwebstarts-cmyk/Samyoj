import prisma from '../../config/database';
import { emitToOrg } from '../../realtime';
import { createModuleLogger } from '../../utils/logger';
import { pickAgentForHandoff as pickAgent } from '../team/assignment';

const log = createModuleLogger('ai-handoff');

export async function pickAgentForHandoff(organizationId: string): Promise<string | null> {
  return pickAgent(organizationId);
}

export async function assignAgentOnHandoff(
  organizationId: string,
  conversationId: string
): Promise<{ id: string; name: string } | null> {
  const agentId = await pickAgentForHandoff(organizationId);
  if (!agentId) return null;

  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true, name: true },
  });
  if (!agent) return null;

  await prisma.conversation.updateMany({
    where: { id: conversationId, organizationId },
    data: { assignedAgentId: agent.id },
  });

  emitToOrg(organizationId, 'conversation:assigned', {
    conversationId,
    assignedAgent: { id: agent.id, name: agent.name },
  });

  log.info('Agent assigned on handoff', { conversationId, agentId: agent.id });
  return { id: agent.id, name: agent.name };
}
