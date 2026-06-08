import prisma from '../../config/database';
import { isWithinBusinessHours } from '../settings/business-hours';
import { getOrgBusinessHours } from '../settings/business-hours';
import { getEligibleAgents } from '../team/assignment';
import { getOrgCallingSettings } from './settings.service';
import type { CallingSettings } from './calling-settings.types';
import { getOrgActiveCallCount } from './session-store';

export type CallRouteDecision =
  | { mode: 'ai'; reason: string }
  | { mode: 'ring_agents'; agentIds: string[]; reason: string }
  | { mode: 'missed'; reason: string; afterHoursMessage?: string };

export async function decideCallRoute(organizationId: string): Promise<CallRouteDecision> {
  const [settings, businessHours, activeCount] = await Promise.all([
    getOrgCallingSettings(organizationId),
    getOrgBusinessHours(organizationId),
    getOrgActiveCallCount(organizationId),
  ]);

  if (activeCount >= settings.maxConcurrentCalls) {
    return { mode: 'missed', reason: 'max_concurrent_calls' };
  }

  const withinHours = isWithinBusinessHours(businessHours);

  if (!withinHours) {
    if (settings.afterHoursMode === 'ai' && settings.aiAutoAnswer) {
      return { mode: 'ai', reason: 'after_hours_ai' };
    }
    if (settings.afterHoursMode === 'message') {
      return {
        mode: 'missed',
        reason: 'after_hours',
        afterHoursMessage: settings.afterHoursMessage,
      };
    }
    return { mode: 'missed', reason: 'after_hours' };
  }

  if (settings.routingMode === 'ai_only') {
    if (!settings.aiAutoAnswer) {
      return { mode: 'missed', reason: 'ai_disabled' };
    }
    return { mode: 'ai', reason: 'ai_only' };
  }

  const eligible = await getEligibleAgents(organizationId);
  const onlineAgents = eligible.filter((a) => a.availability === 'ONLINE');

  if (settings.routingMode === 'agents_first') {
    if (onlineAgents.length > 0) {
      return {
        mode: 'ring_agents',
        agentIds: onlineAgents.map((a) => a.userId),
        reason: 'agents_first',
      };
    }
    if (settings.aiAutoAnswer) {
      return { mode: 'ai', reason: 'no_agents_fallback_ai' };
    }
    return { mode: 'missed', reason: 'no_agents_available' };
  }

  // ai_then_agents: try AI first (default current behavior)
  if (settings.aiAutoAnswer) {
    return { mode: 'ai', reason: 'ai_then_agents' };
  }

  if (onlineAgents.length > 0) {
    return {
      mode: 'ring_agents',
      agentIds: onlineAgents.map((a) => a.userId),
      reason: 'ai_disabled_ring_agents',
    };
  }

  return { mode: 'missed', reason: 'no_handlers' };
}

export async function resolveCallBot(
  organizationId: string,
  settings: CallingSettings,
  conversationId: string
) {
  if (settings.defaultBotId) {
    const bot = await prisma.aiBot.findFirst({
      where: { id: settings.defaultBotId, organizationId, enabled: true },
    });
    if (bot) return bot;
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId },
    include: { activeBot: true },
  });

  if (conversation?.activeBot?.enabled) return conversation.activeBot;

  const { resolveBotForConversation, ensureDefaultBot } = await import('../ai/bot.service');
  return (
    (await resolveBotForConversation(organizationId, conversation!, '')) ??
    (await ensureDefaultBot(organizationId))
  );
}
