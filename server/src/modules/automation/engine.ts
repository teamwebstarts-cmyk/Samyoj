import prisma from '../../config/database';
import { automationQueue, flowQueue } from '../../config/queues';
import { generateBotReply, logAutomationRun, performHandoff } from '../ai/chatbot.service';
import { isOperatorVisibleAiSkip, operatorMessageForSkip } from '../ai/voice-fallback';
import { emitToOrg } from '../../realtime';
import { hasEnabledBots } from '../ai/bot.service';
import { withAiBotConversationLock } from '../ai/lock';
import { deliverOutboundMessage, isCswClosedError } from '../messages/send.service';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { getActiveWhatsappNumberCredentials } from '../whatsapp/context';
import { handleInboundFlow } from '../flows/engine';
import { FLOW_LOCK_BUSY, inboundLockRetryJobId, type HandleInboundFlowResult } from '../flows/inbound-wait';
import { decideInboundFunnel } from './inbound-funnel';
import { hasRecentStaticReply } from './frequency';
import {
  getInboundPipeline,
  isInboundStageComplete,
  markInboundPipelineStage,
  claimInboundPipelineStage,
  releaseInboundPipelineStage,
} from './inbound-pipeline';
import { keywordMatches } from '../flows/trigger-match';
import { getOrgBusinessHours, isWithinBusinessHours } from '../settings/business-hours';
import { createModuleLogger } from '../../utils/logger';
import { emitProductEvent } from '../platform/events';
import {
  resolveChatAiEffectivelyOn,
  syncConversationChatAiFromGlobal,
} from '../chat/chat-ai-live';

const log = createModuleLogger('automation-engine');
const AI_BOT_DEBOUNCE_MS = 1500;

const CONVERSATION_AI_SELECT = {
  id: true,
  botActive: true,
  whatsappNumberId: true,
  activeBotId: true,
  botAssignmentSource: true,
  botHandoffAt: true,
  assignedAgentId: true,
  status: true,
} as const;

async function loadConversationForChatAi(
  organizationId: string,
  conversationId: string,
  whatsappNumberId?: string
) {
  const row = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      organizationId,
      ...(whatsappNumberId ? { whatsappNumberId } : {}),
    },
    select: CONVERSATION_AI_SELECT,
  });
  if (!row) return null;
  const synced = await syncConversationChatAiFromGlobal(organizationId, row);
  const { live } = await resolveChatAiEffectivelyOn(organizationId, synced);
  const botActiveForAutomation =
    synced.botActive === true ? live : live && !synced.botHandoffAt;
  return { ...row, ...synced, botActiveForAutomation };
}

/** BullMQ refuses Job.remove() while the worker holds the lock. */
export function isUnremovableQueueState(state: string): boolean {
  return state === 'active' || state === 'waiting-children';
}

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
  /** Stable DB workspace id; credentials are resolved immediately before send. */
  whatsappNumberId: string;
  content: string;
  buttonReplyId?: string;
  isNewConversation: boolean;
  messageType?: string;
  hasMedia?: boolean;
  waFlowResponse?: Record<string, unknown>;
  lockRetry?: number;
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
  whatsappNumberId: string,
  triggerType: string,
  context: AutomationContext
): Promise<MatchedAutomation | null> {
  const automations = await prisma.automation.findMany({
    where: {
      organizationId,
      whatsappNumberId,
      triggerType: triggerType as never,
      enabled: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const automation of automations) {
    const config = automation.config as Record<string, unknown>;
    const buttons = Array.isArray(config.buttons)
      ? (config.buttons as Array<{ id: string; title: string }>)
      : undefined;

    if (triggerType === 'KEYWORD' && context.message) {
      if (keywordMatches(context.message, { keyword: config.keyword as string | undefined })) {
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
      const keyword = config.keyword as string | undefined;
      if (!keyword?.trim() || keywordMatches(context.message, { keyword })) {
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
  whatsappNumberId: string,
  context: AutomationContext,
  conversationId?: string
): Promise<MatchedAutomation | null> {
  const hours = await getOrgBusinessHours(organizationId);
  const withinHours = isWithinBusinessHours(hours);
  const hoursContext = { ...context, isBusinessHours: withinHours };

  const matched = (
    (context.message
      ? await processRuleAutomations(organizationId, whatsappNumberId, 'KEYWORD', { message: context.message })
      : null) ||
    (context.isNewConversation
      ? await processRuleAutomations(organizationId, whatsappNumberId, 'WELCOME', { isNewConversation: true })
      : null) ||
    (context.message
      ? await processRuleAutomations(organizationId, whatsappNumberId, 'LEAD_CAPTURE', { message: context.message })
      : null) ||
    (!withinHours
      ? await processRuleAutomations(organizationId, whatsappNumberId, 'AWAY', hoursContext)
      : null) ||
    (await processRuleAutomations(organizationId, whatsappNumberId, 'BUSINESS_HOURS', hoursContext))
  );

  if (matched) return matched;

  // Fallback: If outside business hours and organization has configured away auto-reply in Business Hours settings
  if (!withinHours && hours.awayMessageEnabled && hours.awayMessage?.trim()) {
    if (conversationId) {
      const recentAway = await prisma.message.findFirst({
        where: {
          conversationId,
          direction: 'OUTBOUND',
          metadata: { path: ['triggerType'], equals: 'AWAY' },
          createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (recentAway) {
        return null;
      }
    }

    return {
      id: 'settings_away',
      name: 'Business Hours Away Reply',
      triggerType: 'AWAY',
      message: hours.awayMessage.trim(),
    };
  }

  return null;
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
  const credentials = await getActiveWhatsappNumberCredentials(
    payload.organizationId,
    payload.whatsappNumberId
  );
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: payload.conversationId,
      organizationId: payload.organizationId,
      whatsappNumberId: credentials.whatsappNumberId,
      contactId: payload.contactId,
    },
    select: { contact: { select: { phone: true } } },
  });
  if (!conversation?.contact) {
    throw new Error('Automation message context does not belong to the active WhatsApp number');
  }
  const automationInboundMessageId = `${payload.messageId}:${triggerType}`;
  const existingOutbound = await prisma.message.findFirst({
    where: {
      conversationId: payload.conversationId,
      direction: 'OUTBOUND',
      metadata: { path: ['automationInboundMessageId'], equals: automationInboundMessageId },
    },
    select: { id: true, status: true },
  });
  if (existingOutbound && ['SENT', 'DELIVERED', 'READ'].includes(existingOutbound.status)) {
    return;
  }
  const autoMsg =
    existingOutbound ??
    (await prisma.message.create({
      data: {
        conversationId: payload.conversationId,
        direction: 'OUTBOUND',
        type: hasButtons ? 'INTERACTIVE' : 'TEXT',
        content,
        status: 'PENDING',
        metadata: {
          source: 'automation',
          triggerType,
          automationInboundMessageId,
          ...(options?.automationId ? { automationId: options.automationId } : {}),
          ...(options?.automationName ? { automationName: options.automationName } : {}),
          ...(hasButtons ? { buttons: options!.buttons } : {}),
        },
      },
    }));

  try {
    await deliverOutboundMessage({
      organizationId: payload.organizationId,
      whatsappNumberId: credentials.whatsappNumberId,
      messageId: autoMsg.id,
      to: conversation.contact.phone,
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
    emitProductEvent({
      organizationId: payload.organizationId,
      name: 'AUTOMATION_RAN',
    });
  } catch (err) {
    const skippedCsw = isCswClosedError(err);
    await logAutomationRun({
      organizationId: payload.organizationId,
      conversationId: payload.conversationId,
      triggerType,
      action: 'send_reply',
      status: skippedCsw ? 'skipped' : 'failed',
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    });
    if (!skippedCsw) {
      emitProductEvent({
        organizationId: payload.organizationId,
        name: 'AUTOMATION_ERROR',
      });
    }
    if (!skippedCsw) throw err;
  }
}

export async function queueAiBotProcessing(payload: InboundAutomationPayload): Promise<void> {
  if (!(await hasEnabledBots(payload.organizationId))) return;

  const conversation = await loadConversationForChatAi(
    payload.organizationId,
    payload.conversationId,
    payload.whatsappNumberId
  );
  if (!conversation?.botActiveForAutomation) {
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
  const jobOpts = {
    delay: AI_BOT_DEBOUNCE_MS,
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 2000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  };

  const existing = await automationQueue.getJob(jobId);
  if (existing) {
    let state = 'unknown';
    try {
      state = await existing.getState();
    } catch {
      /* job may already be gone */
    }

    if (isUnremovableQueueState(state)) {
      await automationQueue.add('ai-chatbot', payload, {
        ...jobOpts,
        jobId: `${jobId}-${payload.messageId}`,
        delay: Math.max(AI_BOT_DEBOUNCE_MS, 2500),
      });
      log.info('AI chatbot already running — queued follow-up', {
        conversationId: payload.conversationId,
        messageId: payload.messageId,
      });
      return;
    }

    try {
      await existing.remove();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn('Could not replace AI chatbot debounce job', {
        conversationId: payload.conversationId,
        error: message,
      });
      await automationQueue.add('ai-chatbot', payload, {
        ...jobOpts,
        jobId: `${jobId}-${payload.messageId}`,
      });
      log.info('Queued AI chatbot follow-up after locked debounce', {
        conversationId: payload.conversationId,
      });
      return;
    }
  }

  await automationQueue.add('ai-chatbot', payload, {
    jobId,
    ...jobOpts,
  });

  log.info('Queued AI chatbot job (debounced)', { conversationId: payload.conversationId });
}

export async function processAiChatbotJob(payload: InboundAutomationPayload): Promise<void> {
  const result = await withAiBotConversationLock(payload.conversationId, async () => {
    try {
      const credentials = await getActiveWhatsappNumberCredentials(
        payload.organizationId,
        payload.whatsappNumberId
      );
      const accessToken = MetaWhatsAppService.decryptToken(credentials.encryptedToken);
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: payload.conversationId,
          organizationId: payload.organizationId,
          whatsappNumberId: payload.whatsappNumberId,
        },
        select: { contact: { select: { phone: true } } },
      });
      await MetaWhatsAppService.sendTypingIndicator(
        credentials.phoneNumberId,
        accessToken,
        conversation?.contact?.phone || payload.contactPhone
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

    return result;
  });

  // Lock was busy — another job is already processing this conversation.
  if (!result) {
    log.info('AI chatbot job will retry — lock busy', { conversationId: payload.conversationId });
    throw new Error('AI chatbot conversation lock busy');
  }

  const processingStart = Date.now();

  if (result.skipped) {
    await logAutomationRun({
      organizationId: payload.organizationId,
      conversationId: payload.conversationId,
      triggerType: 'AI_CHATBOT',
      action: 'generate_reply',
      status: 'skipped',
      input: { reason: result.skipReason, botId: result.botId },
      durationMs: Date.now() - processingStart,
    });
    if (isOperatorVisibleAiSkip(result.skipReason)) {
      emitToOrg(payload.organizationId, 'conversation:ai_error', {
        conversationId: payload.conversationId,
        skipReason: result.skipReason,
        operatorMessage: operatorMessageForSkip(result.skipReason),
      });
    }
    // Still deliver polite replies that accompany a skip (e.g. outside business hours, rate limit).
    if (result.reply) {
      await sendAutomationReply(payload, result.reply, 'AI_CHATBOT');
    }
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
    durationMs: Date.now() - processingStart,
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
}

export async function handleInboundAutomations(payload: InboundAutomationPayload): Promise<void> {
  const pipeline = await getInboundPipeline(payload.messageId);

  const conversation = await loadConversationForChatAi(
    payload.organizationId,
    payload.conversationId,
    payload.whatsappNumberId
  );
  const paused = decideInboundFunnel({
    botActive: conversation?.botActiveForAutomation,
  });
  if (paused.type === 'skip' && paused.reason === 'paused') {
    await logAutomationRun({
      organizationId: payload.organizationId,
      conversationId: payload.conversationId,
      triggerType: 'FLOW',
      action: 'bot_paused',
      status: 'skipped',
    });
    return;
  }

  let flowHandled: HandleInboundFlowResult = pipeline.flowHandled ?? false;
  if (!isInboundStageComplete(pipeline, 'flow')) {
    const claimedFlow = await claimInboundPipelineStage(payload.messageId, 'flow');
    if (claimedFlow) {
      flowHandled = await handleInboundFlow({
        organizationId: payload.organizationId,
        conversationId: payload.conversationId,
        contactId: payload.contactId,
        messageId: payload.messageId,
        contactPhone: payload.contactPhone,
        whatsappNumberId: payload.whatsappNumberId,
        content: payload.content,
        buttonReplyId: payload.buttonReplyId,
        isNewConversation: payload.isNewConversation,
        messageType: payload.messageType,
        hasMedia: payload.hasMedia,
        waFlowResponse: payload.waFlowResponse,
      });
      if (flowHandled === FLOW_LOCK_BUSY) {
        await releaseInboundPipelineStage(payload.messageId, 'flow');
      } else {
        await markInboundPipelineStage(payload.messageId, { flow: true, flowHandled });
      }
    }
  }

  const refreshed = await loadConversationForChatAi(
    payload.organizationId,
    payload.conversationId,
    payload.whatsappNumberId
  );

  const afterFlow = decideInboundFunnel({
    botActive: refreshed?.botActiveForAutomation,
    flowHandled,
    lockRetry: payload.lockRetry,
  });

  if (afterFlow.type === 'requeue') {
    const attempt = payload.lockRetry ?? 0;
    const jobId = inboundLockRetryJobId(payload.conversationId, payload.messageId);
    try {
      const existing = await flowQueue.getJob(jobId);
      if (existing) await existing.remove();
    } catch {
      /* job may already have been consumed */
    }
    await flowQueue.add(
      'retry-inbound',
      { ...payload, lockRetry: attempt + 1 },
      {
        delay: Math.min(300 * (attempt + 1), 3000),
        jobId,
        attempts: 1,
        removeOnComplete: 50,
        removeOnFail: 100,
      }
    );
    log.info('Requeued inbound — conversation lock busy', {
      conversationId: payload.conversationId,
      attempt: attempt + 1,
    });
    return;
  }

  if (afterFlow.type === 'skip' && afterFlow.reason === 'lock_giveup') {
    log.warn('Giving up inbound requeue after lock busy', {
      conversationId: payload.conversationId,
      attempts: payload.lockRetry ?? 0,
    });
    await logAutomationRun({
      organizationId: payload.organizationId,
      conversationId: payload.conversationId,
      triggerType: 'FLOW',
      action: 'lock_giveup',
      status: 'failed',
      error: `Conversation lock busy after ${payload.lockRetry ?? 0} retries — message dropped.`,
    });
    emitProductEvent({ organizationId: payload.organizationId, name: 'AUTOMATION_ERROR' });
    return;
  }

  if (afterFlow.type === 'flow_done') return;

  if (refreshed?.assignedAgentId && refreshed.status !== 'OPEN') {
    await logAutomationRun({
      organizationId: payload.organizationId,
      conversationId: payload.conversationId,
      triggerType: 'STATIC',
      action: 'agent_assigned',
      status: 'skipped',
    });
    return;
  }

  const optedOut = await prisma.contact.findFirst({
    where: {
      id: payload.contactId,
      organizationId: payload.organizationId,
      whatsappNumberId: payload.whatsappNumberId,
    },
    select: { optedIn: true },
  });
  const afterOptOut = decideInboundFunnel({
    botActive: refreshed?.botActiveForAutomation,
    flowHandled: false,
    optedIn: optedOut?.optedIn,
  });
  if (afterOptOut.type === 'skip') {
    await logAutomationRun({
      organizationId: payload.organizationId,
      conversationId: payload.conversationId,
      triggerType: 'STATIC',
      action: 'bot_paused',
      status: 'skipped',
    });
    return;
  }

  const pauseBeforeStatic = decideInboundFunnel({
    botActive: refreshed?.botActiveForAutomation,
  });
  if (pauseBeforeStatic.type === 'skip' && pauseBeforeStatic.reason === 'paused') {
    await logAutomationRun({
      organizationId: payload.organizationId,
      conversationId: payload.conversationId,
      triggerType: 'STATIC',
      action: 'bot_paused',
      status: 'skipped',
    });
    return;
  }

  const staticReply = await resolveStaticAutoReply(
    payload.organizationId,
    payload.whatsappNumberId,
    {
      message: payload.content,
      isNewConversation: payload.isNewConversation,
      isBusinessHours: await checkBusinessHours(payload.organizationId),
    },
    payload.conversationId
  );

  if (staticReply) {
    if (isInboundStageComplete(pipeline, 'static')) {
      return;
    }
    if (
      await hasRecentStaticReply({
        organizationId: payload.organizationId,
        conversationId: payload.conversationId,
        automationId: staticReply.id,
      })
    ) {
      await logAutomationRun({
        organizationId: payload.organizationId,
        conversationId: payload.conversationId,
        automationId: staticReply.id,
        triggerType: staticReply.triggerType,
        action: 'frequency_cap',
        status: 'skipped',
      });
      log.info('Skipping auto-reply — frequency cap', {
        conversationId: payload.conversationId,
        automationId: staticReply.id,
      });
    } else if (await claimInboundPipelineStage(payload.messageId, 'static')) {
      await sendAutomationReply(payload, staticReply.message, staticReply.triggerType, {
        buttons: staticReply.buttons,
        automationId: staticReply.id,
        automationName: staticReply.name,
      });

      if (staticReply.tag) {
        const contact = await prisma.contact.findFirst({
          where: {
            id: payload.contactId,
            organizationId: payload.organizationId,
            whatsappNumberId: payload.whatsappNumberId,
          },
        });
        if (contact && !contact.tags.includes(staticReply.tag)) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: { tags: { push: staticReply.tag } },
          });
        }
      }
      if (staticReply.handoff) {
        await performHandoff(payload.organizationId, payload.conversationId, 'LEAD_CAPTURE');
      }
      return;
    } else {
      return;
    }
  }

  if (await claimInboundPipelineStage(payload.messageId, 'ai')) {
    await queueAiBotProcessing(payload);
  }
}

/**
 * Rebuild an inbound automation payload from the durable Inbox message.
 *
 * Webhook processing acknowledges Meta after persisting the message. If the
 * process fails after that commit, this lets a queue retry the automation
 * without copying message content, phone data, or credentials into the job.
 */
export async function retryInboundAutomations(jobData: {
  organizationId: string;
  conversationId: string;
  contactId: string;
  messageId: string;
  whatsappNumberId: string;
  isNewConversation: boolean;
  lockRetry?: number;
}): Promise<void> {
  const message = await prisma.message.findFirst({
    where: {
      id: jobData.messageId,
      direction: 'INBOUND',
      conversation: {
        id: jobData.conversationId,
        organizationId: jobData.organizationId,
        whatsappNumberId: jobData.whatsappNumberId,
        contactId: jobData.contactId,
      },
    },
    select: { content: true, type: true, metadata: true },
  });
  if (!message) return;

  const metadata =
    message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
      ? (message.metadata as Record<string, unknown>)
      : {};
  const waFlowResponse =
    metadata.waFlowResponse && typeof metadata.waFlowResponse === 'object'
      ? (metadata.waFlowResponse as Record<string, unknown>)
      : undefined;

  await handleInboundAutomations({
    organizationId: jobData.organizationId,
    conversationId: jobData.conversationId,
    contactId: jobData.contactId,
    messageId: jobData.messageId,
    contactPhone: '',
    whatsappNumberId: jobData.whatsappNumberId,
    content: message.content || '',
    buttonReplyId: typeof metadata.buttonReplyId === 'string' ? metadata.buttonReplyId : undefined,
    isNewConversation: jobData.isNewConversation,
    messageType: message.type.toLowerCase(),
    hasMedia: ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(message.type),
    waFlowResponse,
    lockRetry: jobData.lockRetry,
  });
}

export async function processAutomations(
  organizationId: string,
  whatsappNumberId: string,
  triggerType: string,
  context: AutomationContext
): Promise<MatchedAutomation | null> {
  return processRuleAutomations(organizationId, whatsappNumberId, triggerType, context);
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
