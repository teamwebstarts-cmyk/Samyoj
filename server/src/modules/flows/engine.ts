import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { deliverOutboundMessage } from '../messages/send.service';
import { logAutomationRun, performHandoff } from '../ai/chatbot.service';
import { queueAiBotProcessing } from '../automation/engine';
import { getOrgBusinessHours, isWithinBusinessHours } from '../settings/business-hours';
import { flowQueue } from '../../config/queues';
import { createModuleLogger } from '../../utils/logger';
import { withConversationLock } from './lock';
import { incrementFlowStat } from './analytics';
import { detectMessageLanguage } from './language';
import {
  HANDOFF_KEYWORDS,
  type FlowNode,
  type FlowState,
  type FlowTriggerConfig,
  type InboundFlowPayload,
} from './types';

const log = createModuleLogger('flow-engine');

function parseNodes(raw: unknown): FlowNode[] {
  if (!Array.isArray(raw)) return [];
  return raw as FlowNode[];
}

function getFlowState(botState: unknown): FlowState | null {
  if (!botState || typeof botState !== 'object') return null;
  const state = botState as Record<string, unknown>;
  if (!state.flowId || !state.currentNodeId) return null;
  return {
    flowId: state.flowId as string,
    currentNodeId: state.currentNodeId as string,
    waitingFor: (state.waitingFor as FlowState['waitingFor']) || null,
    variables: (state.variables as Record<string, string>) || {},
    attempts: (state.attempts as number) || 0,
    resumeAt: state.resumeAt as string | undefined,
  };
}

async function saveFlowState(conversationId: string, state: FlowState | null): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { botState: state ? (state as unknown as Prisma.InputJsonValue) : Prisma.JsonNull },
  });
}

function findNode(nodes: FlowNode[], nodeId: string): FlowNode | undefined {
  return nodes.find((n) => n.id === nodeId);
}

function getStartNode(nodes: FlowNode[], startNodeId?: string | null): FlowNode | undefined {
  if (startNodeId) return findNode(nodes, startNodeId);
  return nodes[0];
}

function interpolate(text: string, variables: Record<string, string>, contactName?: string | null): string {
  const vars: Record<string, string> = { ...variables, name: variables.name || contactName || 'there' };
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] || '');
}

function resolveNextNode(node: FlowNode, buttonReplyId?: string): string | null {
  if (node.type === 'buttons' && buttonReplyId) {
    return node.branches?.[buttonReplyId] || node.next || null;
  }
  return node.next || null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value: string): boolean {
  return /^\+?[\d\s\-()]{7,15}$/.test(value.trim());
}

function wantsHandoff(message: string): boolean {
  const lower = message.toLowerCase();
  return HANDOFF_KEYWORDS.some((kw) => lower.includes(kw));
}

function keywordMatches(content: string, config: FlowTriggerConfig): boolean {
  const keyword = config.keyword?.toLowerCase();
  if (!keyword) return false;
  const lower = content.toLowerCase();
  if (config.regex) {
    try {
      return new RegExp(keyword, 'i').test(content);
    } catch {
      return false;
    }
  }
  if (config.exactMatch) return lower.trim() === keyword;
  return lower.includes(keyword);
}

async function logNode(
  flowId: string,
  payload: InboundFlowPayload,
  node: FlowNode,
  status: 'success' | 'failed',
  output?: unknown,
  error?: string,
  durationMs?: number
) {
  await logAutomationRun({
    organizationId: payload.organizationId,
    conversationId: payload.conversationId,
    flowId,
    triggerType: 'FLOW',
    action: `node:${node.type}`,
    status,
    output: { nodeId: node.id, ...(output as object) },
    error,
    durationMs,
  });
}

async function sendFlowMessage(
  payload: InboundFlowPayload,
  content: string,
  variables: Record<string, string>,
  contactName?: string | null,
  type: 'TEXT' | 'INTERACTIVE' | 'TEMPLATE' | 'IMAGE' | 'DOCUMENT' | 'VIDEO' = 'TEXT',
  options?: {
    buttons?: Array<{ id: string; title: string }>;
    templateName?: string;
    templateLanguage?: string;
    mediaUrl?: string;
    mediaCaption?: string;
  }
): Promise<string> {
  const rendered = interpolate(content, variables, contactName);
  const metadata: Record<string, unknown> = { source: 'flow' };
  if (options?.buttons?.length) metadata.buttons = options.buttons;

  const msg = await prisma.message.create({
    data: {
      conversationId: payload.conversationId,
      direction: 'OUTBOUND',
      type: type === 'TEXT' ? 'TEXT' : type === 'INTERACTIVE' ? 'INTERACTIVE' : type === 'TEMPLATE' ? 'TEMPLATE' : type,
      content: rendered,
      status: 'PENDING',
      metadata: metadata as Prisma.InputJsonValue,
    },
  });

  await deliverOutboundMessage({
    organizationId: payload.organizationId,
    messageId: msg.id,
    phoneNumberId: payload.phoneNumberId,
    encryptedToken: payload.encryptedToken,
    to: payload.contactPhone,
    content: rendered,
    type,
    buttons: options?.buttons,
    templateName: options?.templateName,
    templateLanguage: options?.templateLanguage,
    mediaUrl: options?.mediaUrl,
    mediaCaption: options?.mediaCaption,
  });

  return msg.id;
}

async function updateContactField(contactId: string, field: string, value: string): Promise<void> {
  if (field === 'name') {
    await prisma.contact.update({ where: { id: contactId }, data: { name: value } });
    return;
  }
  if (field === 'email') {
    await prisma.contact.update({ where: { id: contactId }, data: { email: value.trim() } });
    return;
  }
  if (field === 'phone') {
    const clean = value.replace(/\D/g, '');
    await prisma.contact.update({ where: { id: contactId }, data: { phone: clean } });
    return;
  }
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  const notes = contact?.notes || '';
  const fieldNote = `${field}: ${value}`;
  const updatedNotes = notes.includes(`${field}:`)
    ? notes.replace(new RegExp(`${field}:.*`), fieldNote)
    : notes ? `${notes}\n${fieldNote}` : fieldNote;
  await prisma.contact.update({ where: { id: contactId }, data: { notes: updatedNotes } });
}

async function addContactTag(contactId: string, tag: string): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact || contact.tags.includes(tag)) return;
  await prisma.contact.update({
    where: { id: contactId },
    data: { tags: { push: tag } },
  });
}

async function assignToAgent(
  organizationId: string,
  conversationId: string,
  agentId?: string
): Promise<void> {
  if (agentId) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedAgentId: agentId, status: 'PENDING' },
    });
    return;
  }

  const agents = await prisma.organizationUser.findMany({
    where: { organizationId, role: { in: ['AGENT', 'ADMIN', 'OWNER'] } },
    orderBy: { user: { name: 'asc' } },
  });
  if (agents.length === 0) return;

  const counts = await Promise.all(
    agents.map(async (a) => ({
      agentId: a.userId,
      count: await prisma.conversation.count({
        where: { organizationId, assignedAgentId: a.userId, status: 'OPEN' },
      }),
    }))
  );
  counts.sort((a, b) => a.count - b.count);
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { assignedAgentId: counts[0].agentId, status: 'PENDING' },
  });
}

async function callWebhook(node: FlowNode, payload: InboundFlowPayload, variables: Record<string, string>) {
  if (!node.webhookUrl) return;
  const method = node.webhookMethod || 'POST';
  const body = {
    organizationId: payload.organizationId,
    conversationId: payload.conversationId,
    contactId: payload.contactId,
    variables,
    timestamp: new Date().toISOString(),
  };

  await fetch(node.webhookUrl, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
}

async function executeNode(
  payload: InboundFlowPayload,
  flowId: string,
  node: FlowNode,
  state: FlowState,
  contactName?: string | null,
  contactTags?: string[]
): Promise<{ done: boolean; nextNodeId: string | null; waitingFor: FlowState['waitingFor'] }> {
  const start = Date.now();

  try {
    switch (node.type) {
      case 'message': {
        if (node.text) await sendFlowMessage(payload, node.text, state.variables, contactName);
        await logNode(flowId, payload, node, 'success', undefined, undefined, Date.now() - start);
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'buttons': {
        if (node.text && node.buttons?.length) {
          await sendFlowMessage(payload, node.text, state.variables, contactName, 'INTERACTIVE', { buttons: node.buttons });
        }
        await logNode(flowId, payload, node, 'success', undefined, undefined, Date.now() - start);
        return { done: false, nextNodeId: null, waitingFor: 'button' };
      }

      case 'question': {
        const prompt = node.prompt || node.text || 'Please reply:';
        await sendFlowMessage(payload, prompt, state.variables, contactName);
        state.attempts = 0;
        await logNode(flowId, payload, node, 'success', undefined, undefined, Date.now() - start);
        return { done: false, nextNodeId: null, waitingFor: 'text' };
      }

      case 'tag': {
        if (node.tag) await addContactTag(payload.contactId, node.tag);
        await logNode(flowId, payload, node, 'success', { tag: node.tag }, undefined, Date.now() - start);
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'assign': {
        if (node.text) await sendFlowMessage(payload, node.text, state.variables, contactName);
        await assignToAgent(payload.organizationId, payload.conversationId, node.assignAgentId);
        await logNode(flowId, payload, node, 'success', undefined, undefined, Date.now() - start);
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'condition': {
        let branchKey = 'false';
        if (node.conditionType === 'business_hours') {
          const hours = await getOrgBusinessHours(payload.organizationId);
          branchKey = isWithinBusinessHours(hours) ? 'true' : 'false';
        } else if (node.conditionType === 'has_tag' && node.conditionTag) {
          branchKey = contactTags?.includes(node.conditionTag) ? 'true' : 'false';
        } else if (node.conditionType === 'language' && node.languageCode) {
          const lang = state.variables.language || state.variables.lang || '';
          branchKey = lang.toLowerCase() === node.languageCode.toLowerCase() ? 'true' : 'false';
        }
        const nextId = node.branches?.[branchKey] || node.next || null;
        await logNode(flowId, payload, node, 'success', { branch: branchKey }, undefined, Date.now() - start);
        return { done: false, nextNodeId: nextId, waitingFor: null };
      }

      case 'handoff': {
        if (node.text) await sendFlowMessage(payload, node.text, state.variables, contactName);
        await performHandoff(payload.organizationId, payload.conversationId, 'FLOW_HANDOFF');
        await incrementFlowStat(flowId, 'handoffs');
        await logNode(flowId, payload, node, 'success', undefined, undefined, Date.now() - start);
        return { done: true, nextNodeId: null, waitingFor: null };
      }

      case 'ai': {
        if (node.text) await sendFlowMessage(payload, node.text, state.variables, contactName);
        await prisma.conversation.update({
          where: { id: payload.conversationId },
          data: {
            activeBotId: node.aiBotId || undefined,
            botActive: true,
            botHandoffAt: null,
            botHandoffReason: null,
          },
        });
        await saveFlowState(payload.conversationId, null);
        await queueAiBotProcessing({
          organizationId: payload.organizationId,
          conversationId: payload.conversationId,
          contactId: payload.contactId,
          messageId: payload.messageId,
          contactPhone: payload.contactPhone,
          phoneNumberId: payload.phoneNumberId,
          encryptedToken: payload.encryptedToken,
          content: payload.content,
          isNewConversation: payload.isNewConversation,
        });
        await logNode(flowId, payload, node, 'success', undefined, undefined, Date.now() - start);
        return { done: true, nextNodeId: null, waitingFor: null };
      }

      case 'end': {
        if (node.text) await sendFlowMessage(payload, node.text, state.variables, contactName);
        await incrementFlowStat(flowId, 'completions');
        await logNode(flowId, payload, node, 'success', undefined, undefined, Date.now() - start);
        return { done: true, nextNodeId: null, waitingFor: null };
      }

      case 'template': {
        if (node.templateName) {
          await sendFlowMessage(payload, node.text || `Template: ${node.templateName}`, state.variables, contactName, 'TEMPLATE', {
            templateName: node.templateName,
            templateLanguage: node.templateLanguage,
          });
        }
        await logNode(flowId, payload, node, 'success', undefined, undefined, Date.now() - start);
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'media': {
        if (node.mediaUrl) {
          const mediaType = node.mediaType === 'document' ? 'DOCUMENT' : node.mediaType === 'video' ? 'VIDEO' : 'IMAGE';
          await sendFlowMessage(payload, node.mediaCaption || node.text || '', state.variables, contactName, mediaType, {
            mediaUrl: node.mediaUrl,
            mediaCaption: node.mediaCaption,
          });
        }
        await logNode(flowId, payload, node, 'success', undefined, undefined, Date.now() - start);
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'delay': {
        const delayMs = Math.min((node.delaySeconds || 5) * 1000, 86400000);
        state.waitingFor = 'delay';
        state.resumeAt = new Date(Date.now() + delayMs).toISOString();
        await saveFlowState(payload.conversationId, state);
        await flowQueue.add(
          'resume-flow',
          {
            conversationId: payload.conversationId,
            organizationId: payload.organizationId,
            flowId,
            nextNodeId: node.next,
            contactId: payload.contactId,
            contactPhone: payload.contactPhone,
            phoneNumberId: payload.phoneNumberId,
            encryptedToken: payload.encryptedToken,
            variables: state.variables,
            messageId: payload.messageId,
            isNewConversation: payload.isNewConversation,
          },
          { delay: delayMs, jobId: `flow-delay-${payload.conversationId}-${Date.now()}` }
        );
        await logNode(flowId, payload, node, 'success', { delaySeconds: node.delaySeconds }, undefined, Date.now() - start);
        return { done: false, nextNodeId: null, waitingFor: 'delay' };
      }

      case 'webhook': {
        await callWebhook(node, payload, state.variables);
        await logNode(flowId, payload, node, 'success', { url: node.webhookUrl }, undefined, Date.now() - start);
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'ab_split': {
        const branchKey = Math.random() < 0.5 ? 'a' : 'b';
        const nextId = node.branches?.[branchKey] || node.next || null;
        await logNode(flowId, payload, node, 'success', { branch: branchKey }, undefined, Date.now() - start);
        return { done: false, nextNodeId: nextId, waitingFor: null };
      }

      case 'language': {
        const branchKey = node.languageCode && state.variables.language === node.languageCode ? 'match' : 'default';
        const nextId = node.branches?.[branchKey] || node.next || null;
        await logNode(flowId, payload, node, 'success', { branch: branchKey }, undefined, Date.now() - start);
        return { done: false, nextNodeId: nextId, waitingFor: null };
      }

      default: {
        log.warn('Unknown flow node type', { type: node.type, nodeId: node.id });
        await logNode(flowId, payload, node, 'failed', undefined, `Unknown node type: ${node.type}`, Date.now() - start);
        return { done: true, nextNodeId: null, waitingFor: null };
      }
    }
  } catch (err) {
    await logNode(
      flowId,
      payload,
      node,
      'failed',
      undefined,
      err instanceof Error ? err.message : String(err),
      Date.now() - start
    );
    throw err;
  }
}

async function runFromNode(
  payload: InboundFlowPayload,
  flowId: string,
  nodes: FlowNode[],
  startNodeId: string,
  state: FlowState,
  contactName?: string | null,
  contactTags?: string[]
): Promise<boolean> {
  let currentId: string | null = startNodeId;
  let iterations = 0;

  while (currentId && iterations < 25) {
    iterations++;
    const node = findNode(nodes, currentId);
    if (!node) {
      await incrementFlowStat(flowId, 'dropoffs', currentId);
      break;
    }

    state.currentNodeId = currentId;
    const result = await executeNode(payload, flowId, node, state, contactName, contactTags);

    if (result.waitingFor) {
      state.waitingFor = result.waitingFor;
      if (result.waitingFor !== 'delay') await saveFlowState(payload.conversationId, state);
      return true;
    }

    state.waitingFor = null;
    currentId = result.nextNodeId;

    if (result.done) {
      await saveFlowState(payload.conversationId, null);
      return true;
    }
  }

  if (iterations >= 25) {
    log.warn('Flow iteration limit exceeded', { flowId, conversationId: payload.conversationId });
    await incrementFlowStat(flowId, 'dropoffs', state.currentNodeId);
  }

  await saveFlowState(payload.conversationId, null);
  return true;
}

async function flowMatchesTrigger(
  flow: { triggerType: string; triggerConfig: unknown },
  payload: InboundFlowPayload,
  withinHours: boolean,
  contactTags: string[]
): Promise<boolean> {
  const config = (flow.triggerConfig as FlowTriggerConfig) || {};

  switch (flow.triggerType) {
    case 'WELCOME':
      return payload.isNewConversation;
    case 'KEYWORD':
      return Boolean(payload.content && keywordMatches(payload.content, config));
    case 'BUSINESS_HOURS':
      return withinHours && Boolean(payload.content);
    case 'OFF_HOURS':
      return !withinHours && Boolean(payload.content);
    case 'ANY_MESSAGE':
      return Boolean(payload.content) && !payload.isNewConversation;
    case 'CONTACT_TAG':
      return Boolean(config.tag && contactTags.includes(config.tag));
    case 'SEGMENT':
      return Boolean(config.tags?.some((t) => contactTags.includes(t)));
    default:
      return false;
  }
}

async function matchFlow(
  organizationId: string,
  payload: InboundFlowPayload,
  contactTags: string[]
): Promise<{ id: string; name: string; nodes: FlowNode[]; startNodeId?: string | null } | null> {
  const hours = await getOrgBusinessHours(organizationId);
  const withinHours = isWithinBusinessHours(hours);

  const flows = await prisma.flow.findMany({
    where: { organizationId, enabled: true, status: 'PUBLISHED' },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  for (const flow of flows) {
    if (await flowMatchesTrigger(flow, payload, withinHours, contactTags)) {
      return {
        id: flow.id,
        name: flow.name,
        nodes: parseNodes(flow.nodes),
        startNodeId: flow.startNodeId,
      };
    }
  }

  return null;
}

function applyLanguageFromMessage(state: FlowState, content?: string): void {
  if (!content?.trim() || state.variables.language) return;
  state.variables.language = detectMessageLanguage(content);
}

function validateAnswer(field: string, value: string): boolean {
  if (field === 'email') return isValidEmail(value);
  if (field === 'phone') return isValidPhone(value);
  if (field === 'name') return value.trim().length >= 2;
  return value.trim().length > 0;
}

async function processInboundFlow(payload: InboundFlowPayload): Promise<boolean> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: payload.conversationId, organizationId: payload.organizationId },
    include: { contact: true },
  });

  if (!conversation) return false;
  if (conversation.botHandoffAt) return false;
  if (conversation.assignedAgentId && conversation.status !== 'OPEN') return false;

  const contactTags = conversation.contact?.tags || [];

  if (payload.content && wantsHandoff(payload.content)) {
    const existingState = getFlowState(conversation.botState);
    if (existingState) {
      await saveFlowState(payload.conversationId, null);
      await performHandoff(payload.organizationId, payload.conversationId, 'USER_REQUEST');
      return true;
    }
  }

  const existingState = getFlowState(conversation.botState);

  if (existingState) {
    applyLanguageFromMessage(existingState, payload.content);
    if (existingState.waitingFor === 'delay') return true;

    const flow = await prisma.flow.findFirst({
      where: { id: existingState.flowId, organizationId: payload.organizationId, enabled: true },
    });
    if (!flow) {
      await saveFlowState(payload.conversationId, null);
      return false;
    }

    const nodes = parseNodes(flow.nodes);
    const currentNode = findNode(nodes, existingState.currentNodeId);
    if (!currentNode) {
      await saveFlowState(payload.conversationId, null);
      return false;
    }

    if (existingState.waitingFor === 'button') {
      if (payload.buttonReplyId) {
        const nextId = resolveNextNode(currentNode, payload.buttonReplyId);
        if (!nextId) {
          await saveFlowState(payload.conversationId, null);
          return true;
        }
        existingState.waitingFor = null;
        existingState.attempts = 0;
        return runFromNode(
          payload,
          flow.id,
          nodes,
          nextId,
          existingState,
          conversation.contact?.name,
          contactTags
        );
      }

      if (payload.content) {
        await sendFlowMessage(
          payload,
          'Please tap one of the buttons above to continue. 👆',
          existingState.variables,
          conversation.contact?.name
        );
        await saveFlowState(payload.conversationId, existingState);
        return true;
      }

      return true;
    }

    if (existingState.waitingFor === 'text' && payload.content) {
      const field = currentNode.field || 'custom';
      const fieldKey = field === 'custom' ? (currentNode.customField || 'answer') : field;
      const maxRetries = currentNode.maxRetries ?? 2;

      if (!validateAnswer(field, payload.content)) {
        existingState.attempts += 1;
        if (existingState.attempts >= maxRetries) {
          await sendFlowMessage(
            payload,
            'Let me connect you with our team for further assistance.',
            existingState.variables,
            conversation.contact?.name
          );
          await performHandoff(payload.organizationId, payload.conversationId, 'VALIDATION_FAILED');
          await saveFlowState(payload.conversationId, null);
          return true;
        }
        await sendFlowMessage(
          payload,
          currentNode.retryMessage || 'Please try again with a valid response.',
          existingState.variables,
          conversation.contact?.name
        );
        await saveFlowState(payload.conversationId, existingState);
        return true;
      }

      existingState.variables[fieldKey] = payload.content;
      existingState.attempts = 0;
      await updateContactField(payload.contactId, fieldKey, payload.content);

      const nextId = currentNode.next;
      if (!nextId) {
        await saveFlowState(payload.conversationId, null);
        return true;
      }

      existingState.waitingFor = null;
      return runFromNode(
        payload,
        flow.id,
        nodes,
        nextId,
        existingState,
        conversation.contact?.name,
        contactTags
      );
    }

    return true;
  }

  const matched = await matchFlow(payload.organizationId, payload, contactTags);
  if (!matched || matched.nodes.length === 0) return false;

  const startNode = getStartNode(matched.nodes, matched.startNodeId);
  if (!startNode) return false;

  const state: FlowState = {
    flowId: matched.id,
    flowName: matched.name,
    currentNodeId: startNode.id,
    waitingFor: null,
    variables: {},
    attempts: 0,
  };

  if (conversation.contact?.name) state.variables.name = conversation.contact.name;
  applyLanguageFromMessage(state, payload.content);

  await incrementFlowStat(matched.id, 'starts');
  log.info('Starting flow', { flowId: matched.id, conversationId: payload.conversationId });

  return runFromNode(
    payload,
    matched.id,
    matched.nodes,
    startNode.id,
    state,
    conversation.contact?.name,
    contactTags
  );
}

export async function handleInboundFlow(payload: InboundFlowPayload): Promise<boolean> {
  const result = await withConversationLock(payload.conversationId, () => processInboundFlow(payload));
  return result ?? false;
}

export async function resumeFlowAfterDelay(jobData: {
  conversationId: string;
  organizationId: string;
  flowId: string;
  nextNodeId: string | null;
  contactId: string;
  contactPhone: string;
  phoneNumberId: string;
  encryptedToken: string;
  variables: Record<string, string>;
  messageId: string;
  isNewConversation: boolean;
}): Promise<void> {
  if (!jobData.nextNodeId) {
    await saveFlowState(jobData.conversationId, null);
    return;
  }

  const flow = await prisma.flow.findFirst({
    where: { id: jobData.flowId, organizationId: jobData.organizationId, enabled: true },
  });
  if (!flow) {
    await saveFlowState(jobData.conversationId, null);
    return;
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: jobData.conversationId, organizationId: jobData.organizationId },
    include: { contact: true },
  });
  if (!conversation || conversation.botHandoffAt) return;

  const state = getFlowState(conversation.botState);
  if (!state || state.flowId !== jobData.flowId) return;

  state.waitingFor = null;
  state.variables = { ...state.variables, ...jobData.variables };

  const payload: InboundFlowPayload = {
    organizationId: jobData.organizationId,
    conversationId: jobData.conversationId,
    contactId: jobData.contactId,
    messageId: jobData.messageId,
    contactPhone: jobData.contactPhone,
    phoneNumberId: jobData.phoneNumberId,
    encryptedToken: jobData.encryptedToken,
    content: '',
    isNewConversation: jobData.isNewConversation,
  };

  await runFromNode(
    payload,
    jobData.flowId,
    parseNodes(flow.nodes),
    jobData.nextNodeId,
    state,
    conversation.contact?.name,
    conversation.contact?.tags || []
  );
}
