import prisma from '../../config/database';
import { automationQueue } from '../../config/queues';
import { generateBotReply, logAutomationRun, performHandoff } from '../ai/chatbot.service';
import { hasEnabledBots } from '../ai/bot.service';
import { deliverOutboundMessage } from '../messages/send.service';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('automation-engine');

export interface AutomationContext {
  message?: string;
  isNewConversation?: boolean;
  isBusinessHours?: boolean;
}

export interface InboundAutomationPayload {
  organizationId: string;
  conversationId: string;
  messageId: string;
  contactPhone: string;
  phoneNumberId: string;
  encryptedToken: string;
  content: string;
  isNewConversation: boolean;
}

function checkBusinessHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  return hour >= 9 && hour < 18;
}

export async function processRuleAutomations(
  organizationId: string,
  triggerType: string,
  context: AutomationContext
): Promise<string | null> {
  const automations = await prisma.automation.findMany({
    where: { organizationId, triggerType: triggerType as never, enabled: true },
    orderBy: { createdAt: 'asc' },
  });

  for (const automation of automations) {
    const config = automation.config as Record<string, unknown>;

    if (triggerType === 'KEYWORD' && context.message) {
      const keyword = (config.keyword as string)?.toLowerCase();
      if (keyword && context.message.toLowerCase().includes(keyword)) {
        return (config.response as string) || (config.message as string) || null;
      }
    }

    if (triggerType === 'WELCOME' && context.isNewConversation) {
      return (config.message as string) || null;
    }

    if (triggerType === 'AWAY' && context.isBusinessHours === false) {
      return (config.message as string) || null;
    }

    if (triggerType === 'BUSINESS_HOURS' && context.isBusinessHours === false) {
      return (config.awayMessage as string) || (config.message as string) || null;
    }

    if (triggerType === 'LEAD_CAPTURE' && context.message) {
      const keyword = (config.keyword as string)?.toLowerCase();
      if (!keyword || context.message.toLowerCase().includes(keyword)) {
        return (config.message as string) || null;
      }
    }
  }

  return null;
}

export async function resolveStaticAutoReply(
  organizationId: string,
  context: AutomationContext
): Promise<string | null> {
  const withinHours = checkBusinessHours();

  return (
    (context.message
      ? await processRuleAutomations(organizationId, 'KEYWORD', { message: context.message })
      : null) ||
    (context.isNewConversation
      ? await processRuleAutomations(organizationId, 'WELCOME', { isNewConversation: true })
      : null) ||
    (!withinHours
      ? await processRuleAutomations(organizationId, 'AWAY', { isBusinessHours: withinHours })
      : null) ||
    (!withinHours
      ? await processRuleAutomations(organizationId, 'BUSINESS_HOURS', {
          isBusinessHours: withinHours,
        })
      : null)
  );
}

export async function sendAutomationReply(
  payload: InboundAutomationPayload,
  content: string,
  triggerType: string
): Promise<void> {
  const start = Date.now();
  const autoMsg = await prisma.message.create({
    data: {
      conversationId: payload.conversationId,
      direction: 'OUTBOUND',
      type: 'TEXT',
      content,
      status: 'PENDING',
      metadata: { source: 'automation', triggerType },
    },
  });

  try {
    await deliverOutboundMessage({
      organizationId: payload.organizationId,
      messageId: autoMsg.id,
      phoneNumberId: payload.phoneNumberId,
      encryptedToken: payload.encryptedToken,
      to: payload.contactPhone,
      content,
      type: 'TEXT',
    });

    await logAutomationRun({
      organizationId: payload.organizationId,
      conversationId: payload.conversationId,
      triggerType,
      action: 'send_reply',
      status: 'success',
      output: { messageId: autoMsg.id },
      durationMs: Date.now() - start,
    });
  } catch (err) {
    await logAutomationRun({
      organizationId: payload.organizationId,
      conversationId: payload.conversationId,
      triggerType,
      action: 'send_reply',
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    });
    throw err;
  }
}

export async function queueAiBotProcessing(payload: InboundAutomationPayload): Promise<void> {
  if (!(await hasEnabledBots(payload.organizationId))) return;

  const conversation = await prisma.conversation.findFirst({
    where: { id: payload.conversationId, organizationId: payload.organizationId },
  });
  if (!conversation?.botActive || conversation.botHandoffAt) {
    log.info('AI bot skipped for conversation', {
      conversationId: payload.conversationId,
      botActive: conversation?.botActive,
      botHandoffAt: conversation?.botHandoffAt,
    });
    return;
  }

  await automationQueue.add('ai-chatbot', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  });

  log.info('Queued AI chatbot job', { conversationId: payload.conversationId });
}

export async function processAiChatbotJob(payload: InboundAutomationPayload): Promise<void> {
  const start = Date.now();
  const result = await generateBotReply({
    organizationId: payload.organizationId,
    conversationId: payload.conversationId,
    inboundMessage: payload.content,
  });

  if (result.skipped) {
    await logAutomationRun({
      organizationId: payload.organizationId,
      conversationId: payload.conversationId,
      triggerType: 'AI_CHATBOT',
      action: 'generate_reply',
      status: 'skipped',
      input: { reason: result.skipReason, botId: result.botId },
      durationMs: Date.now() - start,
    });
    return;
  }

  if (!result.reply) return;

  await sendAutomationReply(payload, result.reply, 'AI_CHATBOT');

  if (result.handoff) {
    await performHandoff(
      payload.organizationId,
      payload.conversationId,
      result.handoffReason || 'USER_REQUEST'
    );
  }
}

export async function handleInboundAutomations(payload: InboundAutomationPayload): Promise<void> {
  const staticReply = await resolveStaticAutoReply(payload.organizationId, {
    message: payload.content,
    isNewConversation: payload.isNewConversation,
    isBusinessHours: checkBusinessHours(),
  });

  if (staticReply) {
    await sendAutomationReply(payload, staticReply, 'RULE');
    return;
  }

  await queueAiBotProcessing(payload);
}

export async function processAutomations(
  organizationId: string,
  triggerType: string,
  context: AutomationContext
): Promise<string | null> {
  return processRuleAutomations(organizationId, triggerType, context);
}

export function isBusinessHours(config: Record<string, unknown>): boolean {
  const start = (config.startHour as number) ?? 9;
  const end = (config.endHour as number) ?? 18;
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  return hour >= start && hour < end;
}
