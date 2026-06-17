import prisma from '../../config/database';
import { automationQueue } from '../../config/queues';
import { generateBotReply, logAutomationRun, performHandoff } from '../ai/chatbot.service';
import { hasEnabledBots } from '../ai/bot.service';
import { withAiBotConversationLock } from '../ai/lock';
import { deliverOutboundMessage } from '../messages/send.service';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { handleInboundFlow } from '../flows/engine';
import { getOrgBusinessHours, isWithinBusinessHours } from '../settings/business-hours';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('automation-engine');
const AI_BOT_DEBOUNCE_MS = 1500;

export interface AutomationContext {
  message?: string;
  isNewConversation?: boolean;
  isBusinessHours?: boolean;
}

export interface InboundAutomationPayload {
  organizationId: string;
  conversationId: string;
  contactId: string;
  messageId: string;
  contactPhone: string;
  phoneNumberId: string;
  encryptedToken: string;
  content: string;
  buttonReplyId?: string;
  isNewConversation: boolean;
  messageType?: string;
  hasMedia?: boolean;
  waFlowResponse?: Record<string, unknown>;
}

async function checkBusinessHours(organizationId: string): Promise<boolean> {
  const hours = await getOrgBusinessHours(organizationId);
  return isWithinBusinessHours(hours);
}

interface MatchedAutomation {
  id: string;
  name: string;
  triggerType: string;
  message: string;
  buttons?: Array<{ id: string; title: string }>;
  tag?: string;
  handoff?: boolean;
}

export async function processRuleAutomations(
  organizationId: string,
  triggerType: string,
  context: AutomationContext
): Promise<MatchedAutomation | null> {
  const automations = await prisma.automation.findMany({
    where: { organizationId, triggerType: triggerType as never, enabled: true },
    orderBy: { createdAt: 'asc' },
  });

  for (const automation of automations) {
    const config = automation.config as Record<string, unknown>;
    const buttons = Array.isArray(config.buttons)
      ? (config.buttons as Array<{ id: string; title: string }>)
      : undefined;

    if (triggerType === 'KEYWORD' && context.message) {
      const keyword = (config.keyword as string)?.toLowerCase();
      if (keyword && context.message.toLowerCase().includes(keyword)) {
        const message = (config.response as string) || (config.message as string);
        if (message) {
          return { id: automation.id, name: automation.name, triggerType, message, buttons };
        }
      }
    }

    if (triggerType === 'WELCOME' && context.isNewConversation) {
      const message = (config.message as string) || null;
      if (message) return { id: automation.id, name: automation.name, triggerType, message, buttons };
    }

    if (triggerType === 'AWAY' && context.isBusinessHours === false) {
      const message = (config.message as string) || null;
      if (message) return { id: automation.id, name: automation.name, triggerType, message, buttons };
    }

    if (triggerType === 'BUSINESS_HOURS') {
      const message =
        context.isBusinessHours === true
          ? (config.duringHoursMessage as string) || (config.message as string)
          : (config.awayMessage as string);
      if (message) return { id: automation.id, name: automation.name, triggerType, message, buttons };
    }

    if (triggerType === 'LEAD_CAPTURE' && context.message) {
      const keyword = (config.keyword as string)?.toLowerCase();
      if (!keyword || context.message.toLowerCase().includes(keyword)) {
        const message = (config.message as string) || null;
        if (message) {
          return {
            id: automation.id,
            name: automation.name,
            triggerType,
            message,
            buttons,
            tag: (config.tag as string) || 'lead',
            handoff: Boolean(config.handoff),
          };
        }
      }
    }
  }

  return null;
}

export async function resolveStaticAutoReply(
  organizationId: string,
  context: AutomationContext
): Promise<MatchedAutomation | null> {
  const withinHours = await checkBusinessHours(organizationId);
  const hoursContext = { ...context, isBusinessHours: withinHours };

  return (
    (context.message
      ? await processRuleAutomations(organizationId, 'KEYWORD', { message: context.message })
      : null) ||
    (context.isNewConversation
      ? await processRuleAutomations(organizationId, 'WELCOME', { isNewConversation: true })
      : null) ||
    (context.message
      ? await processRuleAutomations(organizationId, 'LEAD_CAPTURE', { message: context.message })
      : null) ||
    (!withinHours
      ? await processRuleAutomations(organizationId, 'AWAY', hoursContext)
      : null) ||
    (await processRuleAutomations(organizationId, 'BUSINESS_HOURS', hoursContext))
  );
}

export async function sendAutomationReply(
  payload: InboundAutomationPayload,
  content: string,
  triggerType: string,
  options?: {
    buttons?: Array<{ id: string; title: string }>;
    automationId?: string;
    automationName?: string;
  }
): Promise<void> {
  const start = Date.now();
  const hasButtons = Boolean(options?.buttons?.length);
  const autoMsg = await prisma.message.create({
    data: {
      conversationId: payload.conversationId,
      direction: 'OUTBOUND',
      type: hasButtons ? 'INTERACTIVE' : 'TEXT',
      content,
      status: 'PENDING',
      metadata: {
        source: 'automation',
        triggerType,
        ...(options?.automationId ? { automationId: options.automationId } : {}),
        ...(options?.automationName ? { automationName: options.automationName } : {}),
        ...(hasButtons ? { buttons: options!.buttons } : {}),
      },
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
      type: hasButtons ? 'INTERACTIVE' : 'TEXT',
      buttons: options?.buttons,
      interactive: hasButtons
        ? { mode: 'reply', body: content, buttons: options!.buttons }
        : undefined,
    });

    await logAutomationRun({
      organizationId: payload.organizationId,
      conversationId: payload.conversationId,
      automationId: options?.automationId,
      triggerType,
      action: 'send_reply',
      status: 'success',
      output: { messageId: autoMsg.id, automationName: options?.automationName },
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

  if (conversation.assignedAgentId && conversation.status !== 'OPEN') {
    log.info('AI bot skipped — agent assigned', {
      conversationId: payload.conversationId,
      assignedAgentId: conversation.assignedAgentId,
    });
    return;
  }

  const jobId = `ai-bot-${payload.conversationId}`;
  const existing = await automationQueue.getJob(jobId);
  if (existing) {
    await existing.remove();
  }

  await automationQueue.add('ai-chatbot', payload, {
    jobId,
    delay: AI_BOT_DEBOUNCE_MS,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  });

  log.info('Queued AI chatbot job (debounced)', { conversationId: payload.conversationId });
}

export async function processAiChatbotJob(payload: InboundAutomationPayload): Promise<void> {
  await withAiBotConversationLock(payload.conversationId, async () => {
    try {
      const accessToken = MetaWhatsAppService.decryptToken(payload.encryptedToken);
      await MetaWhatsAppService.sendTypingIndicator(
        payload.phoneNumberId,
        accessToken,
        payload.contactPhone
      );
    } catch {
      /* best-effort typing indicator */
    }

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

    await logAutomationRun({
      organizationId: payload.organizationId,
      conversationId: payload.conversationId,
      triggerType: 'AI_CHATBOT',
      action: 'generate_reply',
      status: 'success',
      input: { botId: result.botId },
      output: {
        botId: result.botId,
        handoff: result.handoff,
        handoffReason: result.handoffReason,
        totalTokens: result.totalTokens,
      },
      durationMs: Date.now() - start,
    });

    if (!result.reply) return;

    await sendAutomationReply(payload, result.reply, 'AI_CHATBOT');

    if (result.handoff) {
      await performHandoff(
        payload.organizationId,
        payload.conversationId,
        result.handoffReason || 'USER_REQUEST'
      );
    }
  });
}

export async function handleInboundAutomations(payload: InboundAutomationPayload): Promise<void> {
  const flowHandled = await handleInboundFlow({
    organizationId: payload.organizationId,
    conversationId: payload.conversationId,
    contactId: payload.contactId,
    messageId: payload.messageId,
    contactPhone: payload.contactPhone,
    phoneNumberId: payload.phoneNumberId,
    encryptedToken: payload.encryptedToken,
    content: payload.content,
    buttonReplyId: payload.buttonReplyId,
    isNewConversation: payload.isNewConversation,
    messageType: payload.messageType,
    hasMedia: payload.hasMedia,
    waFlowResponse: payload.waFlowResponse,
  });

  if (flowHandled) return;

  const staticReply = await resolveStaticAutoReply(payload.organizationId, {
    message: payload.content,
    isNewConversation: payload.isNewConversation,
    isBusinessHours: await checkBusinessHours(payload.organizationId),
  });

  if (staticReply) {
    await sendAutomationReply(payload, staticReply.message, staticReply.triggerType, {
      buttons: staticReply.buttons,
      automationId: staticReply.id,
      automationName: staticReply.name,
    });

    if (staticReply.tag) {
      const contact = await prisma.contact.findUnique({ where: { id: payload.contactId } });
      if (contact && !contact.tags.includes(staticReply.tag)) {
        await prisma.contact.update({
          where: { id: payload.contactId },
          data: { tags: { push: staticReply.tag } },
        });
      }
    }
    if (staticReply.handoff) {
      await performHandoff(payload.organizationId, payload.conversationId, 'LEAD_CAPTURE');
    }
    return;
  }

  await queueAiBotProcessing(payload);
}

export async function processAutomations(
  organizationId: string,
  triggerType: string,
  context: AutomationContext
): Promise<MatchedAutomation | null> {
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
