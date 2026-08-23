import prisma from '../../config/database';
import type { AiBot } from '@prisma/client';
import { isWithinBusinessHours } from '../settings/business-hours';
import { getOrgBusinessHours } from '../settings/business-hours';
import { getEligibleAgents } from '../team/assignment';
import { getOrgCallingSettings } from './settings.service';
import type { CallingSettings } from './calling-settings.types';
import { getOrgActiveCallCount } from './session-store';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('call-routing');

export type CallRouteDecision =
  | { mode: 'ai'; reason: string }
  | { mode: 'ring_agents'; agentIds: string[]; reason: string }
  | { mode: 'missed'; reason: string; afterHoursMessage?: string };

export function shouldRouteCallToAi(input: {
  aiAutoAnswer: boolean;
  answeringBotEnabled: boolean;
  /** Per-contact override. False = this person wants a human. Default / true = eligible for org AI routing. */
  contactCallingAiEnabled?: boolean | null;
}): boolean {
  if (input.contactCallingAiEnabled === false) return false;
  return input.aiAutoAnswer && input.answeringBotEnabled;
}

/** Ring-timeout fallback must not pick up a “person only” caller with AI. */
export function shouldAiAnswerAfterAgentTimeout(input: {
  aiAutoAnswer: boolean;
  hasBot: boolean;
  contactCallingAiEnabled?: boolean | null;
}): boolean {
  if (input.contactCallingAiEnabled === false) return false;
  return input.aiAutoAnswer && input.hasBot;
}

async function answeringCallBotEnabled(
  organizationId: string,
  defaultBotId: string | null
): Promise<boolean> {
  if (!defaultBotId) return false;
  const bot = await prisma.aiBot.findFirst({
    where: { id: defaultBotId, organizationId, channel: 'CALL', enabled: true },
    select: { id: true },
  });
  return Boolean(bot);
}

export async function decideCallRoute(
  organizationId: string,
  contact?: { callingAiEnabled?: boolean | null }
): Promise<CallRouteDecision> {
  const [settings, businessHours, activeCount] = await Promise.all([
    getOrgCallingSettings(organizationId),
    getOrgBusinessHours(organizationId),
    getOrgActiveCallCount(organizationId),
  ]);
  const answeringOn = await answeringCallBotEnabled(organizationId, settings.defaultBotId);

  if (activeCount >= settings.maxConcurrentCalls) {
    return { mode: 'missed', reason: 'max_concurrent_calls' };
  }

  const withinHours = isWithinBusinessHours(businessHours);
  const aiAllowed = shouldRouteCallToAi({
    aiAutoAnswer: settings.aiAutoAnswer,
    answeringBotEnabled: answeringOn,
    contactCallingAiEnabled: contact?.callingAiEnabled,
  });

  if (!withinHours) {
    if (settings.afterHoursMode === 'ai' && aiAllowed) {
      return { mode: 'ai', reason: 'after_hours_ai' };
    }
    if (settings.afterHoursMode === 'message') {
      return {
        mode: 'missed',
        reason: 'after_hours',
        afterHoursMessage: settings.afterHoursMessage,
      };
    }
    if (settings.afterHoursMode === 'ai' && !aiAllowed) {
      log.info('After-hours AI requested but AI calling is not allowed', {
        organizationId,
        aiAutoAnswer: settings.aiAutoAnswer,
        answeringBotEnabled: answeringOn,
        contactCallingAiEnabled: contact?.callingAiEnabled,
      });
      return { mode: 'missed', reason: 'after_hours_ai_unavailable' };
    }
    return { mode: 'missed', reason: 'after_hours' };
  }

  if (settings.routingMode === 'ai_only' && aiAllowed) {
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
    if (aiAllowed) {
      return { mode: 'ai', reason: 'no_agents_fallback_ai' };
    }
    return { mode: 'missed', reason: 'no_agents_available' };
  }

  if (aiAllowed) {
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

export function pickCallBotId(input: {
  assignedCallBotId?: string | null;
  bots: Array<{ id: string; enabled: boolean; isDefault: boolean }>;
}): string | null {
  const enabled = input.bots.filter((bot) => bot.enabled);
  if (enabled.length === 0) return null;
  const ids = new Set(enabled.map((bot) => bot.id));

  // All-calls off (no assigned answering bot) must not fall back to another brain.
  if (input.assignedCallBotId && ids.has(input.assignedCallBotId)) {
    return input.assignedCallBotId;
  }

  return null;
}

export async function resolveCallBot(
  organizationId: string,
  settings: CallingSettings,
  _conversationId: string
): Promise<AiBot | null> {
  const bots = await prisma.aiBot.findMany({
    where: { organizationId, enabled: true, channel: 'CALL' },
    orderBy: { createdAt: 'asc' },
  });

  const pickedId = pickCallBotId({
    assignedCallBotId: settings.defaultBotId,
    bots: bots.map((bot) => ({
      id: bot.id,
      enabled: bot.enabled,
      isDefault: bot.isDefault,
    })),
  });

  return pickedId ? bots.find((bot) => bot.id === pickedId) ?? null : null;
}
