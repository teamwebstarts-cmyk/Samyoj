import prisma from '../../config/database';
import type { AiBot, Contact } from '@prisma/client';
import { emitToOrg } from '../../realtime';
import { createChatCompletion, isAzureOpenAIConfigured, type ChatMessage } from './azure-openai.service';
import { formatKnowledgeContext, searchKnowledgeBase } from './knowledge.service';
import { checkRateLimit } from './rate-limit.service';
import {
  getHandoffKeywords,
  resolveBotForConversation,
  ensureDefaultBot,
  setConversationBot,
} from './bot.service';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('chatbot');

const FALLBACK_MESSAGE =
  "Sorry, I couldn't help with that. Our team will assist you shortly.";
const MAX_CONTEXT = 12;
const MAX_TOKENS = 500;
const TEMPERATURE = 0.7;
const RATE_LIMIT = 30;

export interface GenerateBotReplyInput {
  organizationId: string;
  conversationId: string;
  inboundMessage: string;
  botId?: string;
  channel?: 'text' | 'voice';
}

export interface GenerateBotReplyResult {
  reply: string | null;
  handoff: boolean;
  handoffReason?: string;
  botId?: string;
  botName?: string;
  skipped?: boolean;
  skipReason?: string;
}

function detectHandoff(message: string): boolean {
  const lower = message.toLowerCase();
  return getHandoffKeywords().some((kw) => lower.includes(kw));
}

async function buildConversationMessages(
  conversationId: string,
  bot: AiBot,
  contact: Contact | null | undefined,
  inboundMessage: string,
  channel: 'text' | 'voice' = 'text'
): Promise<ChatMessage[]> {
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: MAX_CONTEXT,
  });

  const knowledge = await searchKnowledgeBase(bot.id, inboundMessage);
  const knowledgeBlock = formatKnowledgeContext(knowledge);

  const systemParts = [
    bot.instructions.trim() || undefined,
    `You are ${bot.name}.`,
    contact?.name ? `Customer name: ${contact.name}.` : undefined,
    knowledgeBlock ? `FAQ:\n${knowledgeBlock}` : 'No FAQ matched — answer carefully or offer team help.',
    channel === 'voice'
      ? 'You are on a live phone call. Reply in 1-2 short spoken sentences. Same language as the caller. No markdown or bullet points.'
      : 'Reply in the same language the customer uses. Keep it short.',
  ].filter(Boolean);

  const messages: ChatMessage[] = [{ role: 'system', content: systemParts.join('\n\n') }];

  for (const msg of history.reverse()) {
    if (!msg.content?.trim()) continue;
    messages.push({
      role: msg.direction === 'INBOUND' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  messages.push({ role: 'user', content: inboundMessage });

  return messages;
}

export async function generateBotReply(
  input: GenerateBotReplyInput
): Promise<GenerateBotReplyResult> {
  const start = Date.now();

  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, organizationId: input.organizationId },
    include: { contact: true },
  });

  if (!conversation) {
    return { reply: null, handoff: false, skipped: true, skipReason: 'conversation_not_found' };
  }

  if (!isAzureOpenAIConfigured()) {
    return { reply: null, handoff: false, skipped: true, skipReason: 'ai_not_configured' };
  }

  const isVoice = input.channel === 'voice';

  if (!isVoice && !conversation.botActive) {
    return { reply: null, handoff: false, skipped: true, skipReason: 'bot_paused' };
  }

  if (!isVoice && conversation.botHandoffAt) {
    return { reply: null, handoff: false, skipped: true, skipReason: 'handoff_done' };
  }

  let bot: AiBot | null = null;
  if (input.botId) {
    bot = await prisma.aiBot.findFirst({
      where: { id: input.botId, organizationId: input.organizationId, enabled: true },
    });
  } else {
    bot = await resolveBotForConversation(
      input.organizationId,
      conversation,
      input.inboundMessage
    );
  }

  if (!bot && isVoice) {
    bot = await ensureDefaultBot(input.organizationId);
  }

  if (!bot) {
    return { reply: null, handoff: false, skipped: true, skipReason: 'no_matching_bot' };
  }

  if (conversation.activeBotId !== bot.id) {
    await setConversationBot(conversation.id, bot.id);
  }

  const rate = await checkRateLimit(`ai-bot:${input.organizationId}:${bot.id}`, RATE_LIMIT);
  if (!rate.allowed) {
    return { reply: FALLBACK_MESSAGE, handoff: false, skipped: true, skipReason: 'rate_limited', botId: bot.id, botName: bot.name };
  }

  if (detectHandoff(input.inboundMessage)) {
    return {
      reply: bot.handoffMessage,
      handoff: true,
      handoffReason: 'USER_REQUEST',
      botId: bot.id,
      botName: bot.name,
    };
  }

  try {
    const messages = await buildConversationMessages(
      conversation.id,
      bot,
      conversation.contact,
      input.inboundMessage,
      input.channel || 'text'
    );

    const completion = await createChatCompletion({
      messages,
      temperature: TEMPERATURE,
      maxTokens: MAX_TOKENS,
    });

    const lowerReply = completion.content.toLowerCase();
    const uncertain =
      lowerReply.includes("i don't know") ||
      lowerReply.includes('connect you with') ||
      lowerReply.includes('team member');

    if (uncertain) {
      return {
        reply: bot.handoffMessage,
        handoff: true,
        handoffReason: 'LOW_CONFIDENCE',
        botId: bot.id,
        botName: bot.name,
      };
    }

    log.info('Bot reply generated', {
      conversationId: conversation.id,
      botId: bot.id,
      durationMs: Date.now() - start,
    });

    return {
      reply: completion.content,
      handoff: false,
      botId: bot.id,
      botName: bot.name,
    };
  } catch (err) {
    log.error('Bot reply failed', {
      conversationId: conversation.id,
      botId: bot.id,
      error: err instanceof Error ? err.message : String(err),
    });

    return {
      reply: FALLBACK_MESSAGE,
      handoff: true,
      handoffReason: 'ERROR',
      botId: bot.id,
      botName: bot.name,
    };
  }
}

export async function performHandoff(
  organizationId: string,
  conversationId: string,
  reason: string
): Promise<void> {
  await prisma.conversation.updateMany({
    where: { id: conversationId, organizationId },
    data: {
      botActive: false,
      botHandoffAt: new Date(),
      botHandoffReason: reason,
      status: 'PENDING',
    },
  });

  emitToOrg(organizationId, 'conversation:handoff', { conversationId, reason });
}

export async function logAutomationRun(data: {
  organizationId: string;
  conversationId?: string;
  automationId?: string;
  triggerType: string;
  action: string;
  status: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs?: number;
}): Promise<void> {
  await prisma.automationLog.create({
    data: {
      organizationId: data.organizationId,
      conversationId: data.conversationId,
      automationId: data.automationId,
      triggerType: data.triggerType,
      action: data.action,
      status: data.status,
      input: data.input as object | undefined,
      output: data.output as object | undefined,
      error: data.error,
      durationMs: data.durationMs,
    },
  });
}
