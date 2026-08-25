import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { deliverOutboundMessage, isCswClosedError, toDbMessageType, type DeliverMessageType } from '../messages/send.service';
import { logAutomationRun, performHandoff } from '../ai/chatbot.service';
import { queueAiBotProcessing } from '../automation/engine';
import { getOrgBusinessHours, isWithinBusinessHours } from '../settings/business-hours';
import { flowQueue } from '../../config/queues';
import { createModuleLogger } from '../../utils/logger';
import { withConversationLock } from './lock';
import { incrementFlowStat } from './analytics';
import { detectMessageLanguage } from './language';
import { isSamePhoneIdentity, normalizePhoneIdentity } from '../../utils/phone';
import { linkFlowNodes } from './link-nodes';
import { matchInteractiveTextIntent, resolveInteractiveBranch, syncButtonNode } from './branch-resolve';
import type { InteractiveMessageOptions } from '../messages/interactive';
import type { TemplateParams } from '../campaigns/types';
import { fetchPinnedWebhook } from '../../utils/safe-webhook-url';
import { partitionFlowsForMatch } from './match-order';
import { keywordMatches, wantsHandoff } from './trigger-match';
import { extractAbSticky } from './ab-sticky';
import { MAX_CROSS_FLOW_HOPS, blockedGotoFlowReason } from './cross-flow';
import { LIVE_FLOW_WHERE, isBotPaused } from './live';

function scopedLiveFlowWhere(whatsappNumberId: string) {
  return { whatsappNumberId, ...LIVE_FLOW_WHERE };
}
import { hasRecentFlowStart } from '../automation/frequency';
import { cancelFlowDelayJob, clearFlowWaitState } from './pause-automation';
import {
  FLOW_LOCK_BUSY,
  flowDelayJobId,
  hasWaFlowResponse,
  shouldInterruptWait,
  type HandleInboundFlowResult,
} from './inbound-wait';
import {
  type FlowNode,
  type FlowState,
  type FlowTriggerConfig,
  type InboundFlowPayload,
} from './types';
import { getCachedMessageTemplate } from '../templates/cache';
import { getTemplateVariableMeta, tokensFromVariableMeta } from '../templates/variable-meta';
import { mergeTemplateParams } from '../campaigns/template-params';
import { templatePlaceholderProfile, assertApprovedCampaignTemplate } from '../campaigns/template-validation';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { getActiveWhatsappNumberCredentials } from '../whatsapp/context';

const log = createModuleLogger('flow-engine');

interface FlowExecutionContext {
  flowPath: Set<string>;
  flowHops: number;
}

async function skipCappedFlowStart(params: {
  organizationId: string;
  conversationId: string;
  flowId: string;
}): Promise<boolean> {
  if (!(await hasRecentFlowStart(params))) return false;
  await logAutomationRun({
    organizationId: params.organizationId,
    conversationId: params.conversationId,
    flowId: params.flowId,
    triggerType: 'FLOW',
    action: 'frequency_cap',
    status: 'skipped',
  });
  log.info('Skipping flow start — frequency cap', params);
  return true;
}

async function recordFlowStart(params: {
  organizationId: string;
  conversationId: string;
  flowId: string;
}): Promise<void> {
  await incrementFlowStat(params.flowId, 'starts');
  await logAutomationRun({
    organizationId: params.organizationId,
    conversationId: params.conversationId,
    flowId: params.flowId,
    triggerType: 'FLOW',
    action: 'start',
    status: 'success',
  });
}

function parseNodes(raw: unknown): FlowNode[] {
  if (!Array.isArray(raw)) return [];
  const synced = (raw as FlowNode[]).map((node) => syncButtonNode(node));
  return linkFlowNodes(synced);
}

function getFlowState(botState: unknown): FlowState | null {
  if (!botState || typeof botState !== 'object') return null;
  const state = botState as Record<string, unknown>;
  if (!state.flowId || !state.currentNodeId) return null;
  return {
    flowId: state.flowId as string,
    flowName: state.flowName as string | undefined,
    currentNodeId: state.currentNodeId as string,
    waitingFor: (state.waitingFor as FlowState['waitingFor']) || null,
    variables: (state.variables as Record<string, string>) || {},
    attempts: (state.attempts as number) || 0,
    resumeAt: state.resumeAt as string | undefined,
    abSticky: extractAbSticky(state),
    flowPath: Array.isArray(state.flowPath)
      ? state.flowPath.filter((value): value is string => typeof value === 'string').slice(0, MAX_CROSS_FLOW_HOPS + 1)
      : undefined,
    flowHops: typeof state.flowHops === 'number' && Number.isInteger(state.flowHops)
      ? Math.max(0, Math.min(state.flowHops, MAX_CROSS_FLOW_HOPS))
      : undefined,
  };
}

async function saveFlowState(
  conversationId: string,
  state: FlowState | null,
  scope?: { organizationId: string; whatsappNumberId: string }
): Promise<void> {
  if (state) {
    await prisma.conversation.updateMany({
      where: scope
        ? { id: conversationId, organizationId: scope.organizationId, whatsappNumberId: scope.whatsappNumberId }
        : { id: conversationId },
      data: { botState: state as unknown as Prisma.InputJsonValue },
    });
    return;
  }
  await clearFlowWaitState(conversationId, scope);
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

function resolveNextNode(node: FlowNode, buttonReplyId?: string, buttonTitle?: string): string | null {
  return resolveInteractiveBranch(node, buttonReplyId, buttonTitle);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value: string): boolean {
  return /^\+?[\d\s\-()]{7,15}$/.test(value.trim());
}

function matchTextIntent(node: FlowNode, content: string): string | null {
  return matchInteractiveTextIntent(node, content);
}

function redactedWebhookUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '[invalid webhook URL]';
  }
}

async function hasRecentCampaignMessage(
  conversationId: string,
  campaignId?: string,
  withinHours = 168
): Promise<boolean> {
  const since = new Date(Date.now() - withinHours * 3600000);
  const messages = await prisma.message.findMany({
    where: { conversationId, direction: 'OUTBOUND', createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { metadata: true },
  });
  return messages.some((m) => {
    const meta = m.metadata as Record<string, unknown> | null;
    if (!meta?.campaignId) return false;
    if (campaignId && meta.campaignId !== campaignId) return false;
    return true;
  });
}

async function logNode(
  flowId: string,
  payload: InboundFlowPayload,
  node: FlowNode,
  status: 'success' | 'failed' | 'skipped',
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
  type: DeliverMessageType = 'TEXT',
  options?: {
    buttons?: Array<{ id: string; title: string }>;
    interactive?: InteractiveMessageOptions;
    templateName?: string;
    templateLanguage?: string;
    templateParams?: { body?: string[]; header?: string[]; headerMediaUrl?: string; couponCode?: string; buttonUrlSuffixes?: string[] };
    mediaUrl?: string;
    mediaCaption?: string;
    flowId?: string;
    flowName?: string;
    location?: { latitude: number; longitude: number; name?: string; address?: string };
    contacts?: Array<{ name: string; phone: string; email?: string }>;
    waFlow?: { flowId: string; flowToken: string; cta: string; screen?: string; body?: string };
  }
): Promise<string> {
  const rendered = interpolate(content, variables, contactName);
  const credentials = await getActiveWhatsappNumberCredentials(
    payload.organizationId,
    payload.whatsappNumberId
  );
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: payload.conversationId,
      organizationId: payload.organizationId,
      whatsappNumberId: credentials.whatsappNumberId,
    },
    select: {
      contactId: true,
      contact: { select: { phone: true } },
    },
  });
  if (!conversation || conversation.contactId !== payload.contactId) {
    throw new Error('Flow message context does not belong to the active WhatsApp number');
  }
  const metadata: Record<string, unknown> = { source: 'flow', triggerType: 'FLOW' };
  if (options?.flowId) metadata.flowId = options.flowId;
  if (options?.flowName) metadata.flowName = options.flowName;
  if (options?.buttons?.length) metadata.buttons = options.buttons;
  if (options?.interactive?.mode === 'cta_url') metadata.ctaType = 'url';
  if (options?.interactive?.mode === 'cta_call') metadata.ctaType = 'call';
  if (options?.interactive?.mode === 'list') metadata.listMenu = true;
  if (options?.waFlow) metadata.waFlow = true;
  if (options?.contacts?.length) metadata.contacts = options.contacts;
  if (options?.location) metadata.location = options.location;

  const dbType = options?.waFlow ? 'INTERACTIVE' : toDbMessageType(type);

  const msg = await prisma.message.create({
    data: {
      conversationId: payload.conversationId,
      direction: 'OUTBOUND',
      type: dbType,
      content: rendered,
      status: 'PENDING',
      metadata: metadata as Prisma.InputJsonValue,
    },
  });

  await deliverOutboundMessage({
    organizationId: payload.organizationId,
    whatsappNumberId: credentials.whatsappNumberId,
    messageId: msg.id,
    to: conversation.contact.phone,
    content: rendered,
    type: options?.waFlow ? 'INTERACTIVE' : type,
    buttons: options?.buttons,
    interactive: options?.interactive,
    templateName: options?.templateName,
    templateLanguage: options?.templateLanguage,
    templateParams: options?.templateParams,
    location: options?.location,
    contacts: options?.contacts,
    waFlow: options?.waFlow,
    mediaUrl: options?.mediaUrl,
    mediaCaption: options?.mediaCaption,
  });

  return msg.id;
}

async function updateContactField(
  payload: Pick<InboundFlowPayload, 'organizationId' | 'whatsappNumberId' | 'contactId'>,
  field: string,
  value: string
): Promise<void> {
  const normalizedField = field.trim().toLowerCase();
  if (!/^(name|email|phone|[a-z][a-z0-9_]{0,49})$/.test(normalizedField)) return;
  const contactWhere = {
    id: payload.contactId,
    organizationId: payload.organizationId,
    whatsappNumberId: payload.whatsappNumberId,
  };
  if (normalizedField === 'name') {
    await prisma.contact.updateMany({ where: contactWhere, data: { name: value } });
    return;
  }
  if (normalizedField === 'email') {
    await prisma.contact.updateMany({ where: contactWhere, data: { email: value.trim() } });
    return;
  }
  if (normalizedField === 'phone') {
    const collected = normalizePhoneIdentity(value);
    if (!collected) return;
    const contact = await prisma.contact.findFirst({ where: contactWhere });
    if (!contact) return;
    const attrs =
      contact.customAttributes &&
      typeof contact.customAttributes === 'object' &&
      !Array.isArray(contact.customAttributes)
        ? { ...(contact.customAttributes as Record<string, unknown>) }
        : {};
    attrs.collectedPhone = collected;
    // Keep WhatsApp wa_id as the unique Inbox key. Overwriting it (e.g. customer typed
    // 90097853115 in a flow while Meta from is 919009785315) creates a second chat.
    if (!isSamePhoneIdentity(contact.normalizedPhone, collected)) {
      log.info('Stored flow phone without changing WhatsApp identity', {
        contactId: payload.contactId,
        whatsappIdentity: contact.normalizedPhone,
        collectedPhone: collected,
      });
    }
    await prisma.contact.updateMany({
      where: contactWhere,
      data: { customAttributes: attrs as Prisma.InputJsonValue },
    });
    return;
  }
  const contact = await prisma.contact.findFirst({ where: contactWhere });
  const notes = contact?.notes || '';
  const fieldNote = `${normalizedField}: ${value}`;
  const fieldPattern = new RegExp(`^${normalizedField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:.*$`, 'm');
  const updatedNotes = notes.includes(`${normalizedField}:`)
    ? notes.replace(fieldPattern, fieldNote)
    : notes ? `${notes}\n${fieldNote}` : fieldNote;
  await prisma.contact.updateMany({ where: contactWhere, data: { notes: updatedNotes } });
}

async function addContactTag(
  payload: Pick<InboundFlowPayload, 'organizationId' | 'whatsappNumberId' | 'contactId'>,
  tag: string
): Promise<void> {
  const contact = await prisma.contact.findFirst({
    where: {
      id: payload.contactId,
      organizationId: payload.organizationId,
      whatsappNumberId: payload.whatsappNumberId,
    },
  });
  if (!contact || contact.tags.includes(tag)) return;
  await prisma.contact.updateMany({
    where: {
      id: payload.contactId,
      organizationId: payload.organizationId,
      whatsappNumberId: payload.whatsappNumberId,
    },
    data: { tags: { push: tag } },
  });
}

async function removeContactTag(
  payload: Pick<InboundFlowPayload, 'organizationId' | 'whatsappNumberId' | 'contactId'>,
  tag: string
): Promise<void> {
  const contact = await prisma.contact.findFirst({
    where: {
      id: payload.contactId,
      organizationId: payload.organizationId,
      whatsappNumberId: payload.whatsappNumberId,
    },
  });
  if (!contact || !contact.tags.includes(tag)) return;
  await prisma.contact.updateMany({
    where: {
      id: payload.contactId,
      organizationId: payload.organizationId,
      whatsappNumberId: payload.whatsappNumberId,
    },
    data: { tags: contact.tags.filter((t) => t !== tag) },
  });
}

async function assignToAgent(
  organizationId: string,
  conversationId: string,
  whatsappNumberId: string,
  agentId?: string
): Promise<void> {
  if (agentId) {
    const member = await prisma.organizationUser.findFirst({
      where: {
        organizationId,
        userId: agentId,
        role: { in: ['AGENT', 'ADMIN', 'OWNER'] },
      },
      select: { userId: true },
    });
    if (!member) {
      log.warn('Flow assignment skipped — agent is not in the organization', {
        organizationId,
        conversationId,
      });
      return;
    }
    await prisma.conversation.updateMany({
      where: { id: conversationId, organizationId, whatsappNumberId },
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
  await prisma.conversation.updateMany({
    where: { id: conversationId, organizationId, whatsappNumberId },
    data: { assignedAgentId: counts[0].agentId, status: 'PENDING' },
  });
}

async function skipIfOptedOut(
  organizationId: string,
  contactId: string,
  conversationId: string,
  whatsappNumberId: string,
  flowId?: string
): Promise<boolean> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId, whatsappNumberId },
    select: { optedIn: true },
  });
  if (contact?.optedIn !== false) return false;

  await cancelFlowDelayJob(conversationId);
  await saveFlowState(conversationId, null, { organizationId, whatsappNumberId });
  await logAutomationRun({
    organizationId,
    conversationId,
    flowId,
    triggerType: 'FLOW',
    action: 'opted_out',
    status: 'skipped',
  });
  log.info('Flow skipped — contact opted out', { conversationId, contactId });
  return true;
}

async function callWebhook(
  node: FlowNode,
  payload: InboundFlowPayload,
  variables: Record<string, string>
): Promise<{ ok: boolean; status: number; body: string } | null> {
  if (!node.webhookUrl) return null;
  const method = node.webhookMethod || 'POST';
  const body = {
    organizationId: payload.organizationId,
    conversationId: payload.conversationId,
    contactId: payload.contactId,
    variables,
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetchPinnedWebhook(node.webhookUrl, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
      timeoutMs: 10_000,
    });
    const text = await res.text().catch(() => '');
    variables.webhook_status = String(res.status);
    variables.webhook_ok = res.ok ? 'true' : 'false';
    variables.webhook_body = text.slice(0, 2000);
    if (node.webhookVariable) {
      variables[node.webhookVariable] = text.slice(0, 500);
    }
    return { ok: res.ok, status: res.status, body: text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    variables.webhook_status = '0';
    variables.webhook_ok = 'false';
    variables.webhook_body = message.slice(0, 2000);
    log.warn('Flow webhook blocked or failed', {
      conversationId: payload.conversationId,
      url: redactedWebhookUrl(node.webhookUrl),
      error: message,
    });
    return { ok: false, status: 0, body: message };
  }
}

async function executeNode(
  payload: InboundFlowPayload,
  flowId: string,
  node: FlowNode,
  state: FlowState,
  contactName?: string | null,
  contactTags?: string[],
  executionContext?: FlowExecutionContext
): Promise<{ done: boolean; nextNodeId: string | null; waitingFor: FlowState['waitingFor'] }> {
  const start = Date.now();

  try {
    switch (node.type) {
      case 'message': {
        if (node.text) {
          await sendFlowMessage(payload, node.text, state.variables, contactName);
        } else {
          log.warn('Flow message node has no text — skipping send', {
            flowId,
            nodeId: node.id,
            conversationId: payload.conversationId,
          });
          await logNode(flowId, payload, node, 'skipped', undefined, 'node.text is empty', Date.now() - start);
          return { done: false, nextNodeId: node.next || null, waitingFor: null };
        }
        await logNode(flowId, payload, node, 'success', undefined, undefined, Date.now() - start);
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'buttons': {
        const mode = node.buttonMode || 'reply';
        if (node.text) {
          if (mode === 'url' && node.ctaUrl) {
            await sendFlowMessage(payload, node.text, state.variables, contactName, 'INTERACTIVE', {
              flowId,
              interactive: { mode: 'cta_url', body: node.text, ctaLabel: node.ctaLabel, ctaUrl: node.ctaUrl },
            });
            await logNode(flowId, payload, node, 'success', { mode: 'url' }, undefined, Date.now() - start);
            return { done: false, nextNodeId: node.next || null, waitingFor: null };
          }
          if (mode === 'call' && node.ctaPhone) {
            await sendFlowMessage(payload, node.text, state.variables, contactName, 'INTERACTIVE', {
              flowId,
              interactive: { mode: 'cta_call', body: node.text, ctaLabel: node.ctaLabel, ctaPhone: node.ctaPhone },
            });
            await logNode(flowId, payload, node, 'success', { mode: 'call' }, undefined, Date.now() - start);
            return { done: false, nextNodeId: node.next || null, waitingFor: null };
          }
          if (node.buttons?.length) {
            const buttons = (node.buttons || [])
              .map((btn, idx) => ({
                id: btn.id?.trim() || `${node.id}-btn-${idx}`,
                title: (btn.title?.trim() || `Option ${idx + 1}`).slice(0, 20),
              }))
              .filter((btn) => btn.title)
              .slice(0, 3);
            if (buttons.length === 0) {
              await logNode(flowId, payload, node, 'failed', undefined, 'No valid reply buttons', Date.now() - start);
              return { done: false, nextNodeId: node.next || null, waitingFor: null };
            }
            await sendFlowMessage(payload, node.text, state.variables, contactName, 'INTERACTIVE', {
              flowId,
              buttons,
              interactive: { mode: 'reply', body: node.text, buttons },
            });
          }
        }
        await logNode(flowId, payload, node, 'success', undefined, undefined, Date.now() - start);
        return { done: false, nextNodeId: null, waitingFor: 'button' };
      }

      case 'list': {
        if (node.text && node.listSections?.length) {
          await sendFlowMessage(payload, node.text, state.variables, contactName, 'INTERACTIVE', {
            flowId,
            interactive: {
              mode: 'list',
              body: node.text,
              listButtonLabel: node.listButtonLabel,
              listSections: node.listSections,
            },
          });
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
        if (node.tag) await addContactTag(payload, node.tag);
        await logNode(flowId, payload, node, 'success', { tag: node.tag }, undefined, Date.now() - start);
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'remove_tag': {
        if (node.tag) await removeContactTag(payload, node.tag);
        await logNode(flowId, payload, node, 'success', { tag: node.tag }, undefined, Date.now() - start);
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'set_variable': {
        if (node.variableName) {
          state.variables[node.variableName] = interpolate(node.variableValue || '', state.variables, contactName);
        }
        await logNode(flowId, payload, node, 'success', { variable: node.variableName }, undefined, Date.now() - start);
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'goto_flow': {
        if (!node.targetFlowId) {
          await logNode(flowId, payload, node, 'failed', undefined, 'Missing target flow', Date.now() - start);
          return { done: true, nextNodeId: null, waitingFor: null };
        }
        const target = await prisma.flow.findFirst({
          where: {
            id: node.targetFlowId,
            organizationId: payload.organizationId,
            ...scopedLiveFlowWhere(payload.whatsappNumberId),
          },
        });
        if (!target) {
          await logNode(flowId, payload, node, 'failed', undefined, 'Target flow not found', Date.now() - start);
          return { done: true, nextNodeId: null, waitingFor: null };
        }
        const targetNodes = parseNodes(target.nodes);
        const targetStart = getStartNode(targetNodes, target.startNodeId);
        if (!targetStart) {
          await logNode(flowId, payload, node, 'failed', undefined, 'Target flow has no start', Date.now() - start);
          return { done: true, nextNodeId: null, waitingFor: null };
        }
        const currentContext = executionContext || {
          flowPath: new Set([flowId]),
          flowHops: 0,
        };
        const blocked = blockedGotoFlowReason(currentContext.flowPath, currentContext.flowHops, target.id);
        if (blocked) {
          await logNode(
            flowId,
            payload,
            node,
            'failed',
            { targetFlowId: target.id },
            blocked === 'cycle' ? 'Cross-flow cycle detected' : 'Cross-flow hop limit exceeded',
            Date.now() - start
          );
          return { done: true, nextNodeId: null, waitingFor: null };
        }
        state.flowId = target.id;
        state.currentNodeId = targetStart.id;
        state.waitingFor = null;
        state.flowPath = [...currentContext.flowPath, target.id];
        state.flowHops = currentContext.flowHops + 1;
        await incrementFlowStat(target.id, 'starts');
        await logNode(flowId, payload, node, 'success', { targetFlowId: target.id }, undefined, Date.now() - start);
        await runFromNode(
          payload,
          target.id,
          targetNodes,
          targetStart.id,
          state,
          contactName,
          contactTags,
          {
            flowPath: new Set([...currentContext.flowPath, target.id]),
            flowHops: currentContext.flowHops + 1,
          }
        );
        if (state.waitingFor) {
          return { done: false, nextNodeId: null, waitingFor: state.waitingFor };
        }
        return { done: true, nextNodeId: null, waitingFor: null };
      }

      case 'request_callback': {
        const callbackTag = node.callbackTag || 'callback-requested';
        await addContactTag(payload, callbackTag);
        if (node.assignAgentId) {
          await assignToAgent(
            payload.organizationId,
            payload.conversationId,
            payload.whatsappNumberId,
            node.assignAgentId === '*' ? undefined : node.assignAgentId
          );
        }
        let notificationSent = true;
        if (node.text) {
          try {
            await sendFlowMessage(payload, node.text, state.variables, contactName, 'TEXT', { flowId });
          } catch (err) {
            notificationSent = false;
            log.warn('Callback notification failed after recording callback request', {
              conversationId: payload.conversationId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        await logNode(
          flowId,
          payload,
          node,
          notificationSent ? 'success' : 'failed',
          { tag: callbackTag, notificationSent },
          notificationSent ? undefined : 'Callback notification failed',
          Date.now() - start
        );
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'assign': {
        await assignToAgent(payload.organizationId, payload.conversationId, payload.whatsappNumberId, node.assignAgentId);
        let notificationSent = true;
        if (node.text) {
          try {
            await sendFlowMessage(payload, node.text, state.variables, contactName);
          } catch (err) {
            notificationSent = false;
            log.warn('Assignment notification failed after assigning conversation', {
              conversationId: payload.conversationId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        await logNode(
          flowId,
          payload,
          node,
          notificationSent ? 'success' : 'failed',
          { notificationSent },
          notificationSent ? undefined : 'Assignment notification failed',
          Date.now() - start
        );
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
        } else if (node.conditionType === 'variable_equals' && node.conditionVariable) {
          const actual = state.variables[node.conditionVariable] || '';
          branchKey = actual === (node.conditionValue || '') ? 'true' : 'false';
        } else if (node.conditionType === 'variable_contains' && node.conditionVariable) {
          const actual = (state.variables[node.conditionVariable] || '').toLowerCase();
          const expected = (node.conditionValue || '').toLowerCase();
          branchKey = expected && actual.includes(expected) ? 'true' : 'false';
        } else if (node.conditionType === 'webhook_ok') {
          branchKey = state.variables.webhook_ok === 'true' ? 'true' : 'false';
        }
        const nextId = node.branches?.[branchKey] || node.next || null;
        await logNode(flowId, payload, node, 'success', { branch: branchKey }, undefined, Date.now() - start);
        return { done: false, nextNodeId: nextId, waitingFor: null };
      }

      case 'handoff': {
        await performHandoff(payload.organizationId, payload.conversationId, 'FLOW_HANDOFF');
        let notificationSent = true;
        if (node.text) {
          try {
            await sendFlowMessage(payload, node.text, state.variables, contactName);
          } catch (err) {
            notificationSent = false;
            log.warn('Handoff notification failed after handoff was recorded', {
              conversationId: payload.conversationId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        await incrementFlowStat(flowId, 'handoffs');
        await logNode(
          flowId,
          payload,
          node,
          notificationSent ? 'success' : 'failed',
          { notificationSent },
          notificationSent ? undefined : 'Handoff notification failed',
          Date.now() - start
        );
        return { done: true, nextNodeId: null, waitingFor: null };
      }

      case 'ai': {
        if (node.text) await sendFlowMessage(payload, node.text, state.variables, contactName);
        await prisma.conversation.updateMany({
          where: {
            id: payload.conversationId,
            organizationId: payload.organizationId,
            whatsappNumberId: payload.whatsappNumberId,
          },
          data: {
            activeBotId: node.aiBotId || undefined,
            botActive: true,
            botHandoffAt: null,
            botHandoffReason: null,
          },
        });
        await saveFlowState(payload.conversationId, null, payload);
        await queueAiBotProcessing({
          organizationId: payload.organizationId,
          conversationId: payload.conversationId,
          contactId: payload.contactId,
          messageId: payload.messageId,
          contactPhone: payload.contactPhone,
          whatsappNumberId: payload.whatsappNumberId,
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
          try {
            const contact = await prisma.contact.findUnique({
              where: {
                id: payload.contactId,
                organizationId: payload.organizationId,
                whatsappNumberId: payload.whatsappNumberId,
              },
              select: { name: true, phone: true, email: true, customAttributes: true },
            });
            const waNumber = await getActiveWhatsappNumberCredentials(
              payload.organizationId,
              payload.whatsappNumberId
            );
            if (!waNumber.wabaId) {
              throw new Error('WhatsApp account is not connected for this flow');
            }
            const accessToken = MetaWhatsAppService.decryptToken(waNumber.encryptedToken);
            const template = await getCachedMessageTemplate(
              payload.organizationId,
              waNumber.wabaId,
              accessToken,
              node.templateName
            );
            if (!template) {
              throw new Error(`Template "${node.templateName}" was not found on the connected WhatsApp account`);
            }
            const mapping = await getTemplateVariableMeta(
              payload.organizationId,
              node.templateName,
              node.templateLanguage || template.language
            );
            const tokens = tokensFromVariableMeta(mapping);
            const bodyComp = template.components?.find((c) => c.type?.toUpperCase() === 'BODY');
            const headerComp = template.components?.find((c) => c.type?.toUpperCase() === 'HEADER');
            const bodyCount =
              templatePlaceholderProfile(bodyComp?.text).numeric.length +
              templatePlaceholderProfile(bodyComp?.text).named.length;
            const headerCount =
              templatePlaceholderProfile(headerComp?.text).numeric.length +
              templatePlaceholderProfile(headerComp?.text).named.length;
            const templateParams = mergeTemplateParams(
              {
                body: Array.from({ length: bodyCount }, (_, i) => tokens.body?.[i] || ''),
                header: Array.from({ length: headerCount }, (_, i) => tokens.header?.[i] || ''),
                couponCode: node.templateCouponCode,
                buttonUrlSuffixes: node.templateButtonUrlSuffixes,
                headerMediaUrl: node.templateHeaderMediaUrl,
              },
              null,
              contact?.name,
              template,
              contact || undefined
            );
            assertApprovedCampaignTemplate(template, {
              name: node.templateName,
              language: node.templateLanguage || template.language,
              params: templateParams,
            });
            await sendFlowMessage(
              payload,
              node.text || `Template: ${node.templateName}`,
              state.variables,
              contactName,
              'TEMPLATE',
              {
                templateName: node.templateName,
                templateLanguage: node.templateLanguage || template.language,
                templateParams,
              }
            );
            await logNode(flowId, payload, node, 'success', undefined, undefined, Date.now() - start);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log.warn('Flow template send failed', {
              templateName: node.templateName,
              error: message,
            });
            await logNode(flowId, payload, node, 'failed', undefined, message, Date.now() - start);
            return { done: true, nextNodeId: null, waitingFor: null };
          }
        } else {
          await logNode(
            flowId,
            payload,
            node,
            'failed',
            undefined,
            'Template name is missing on this flow step',
            Date.now() - start
          );
          return { done: true, nextNodeId: null, waitingFor: null };
        }
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'media': {
        if (node.mediaUrl) {
          try {
            if (new URL(node.mediaUrl).protocol !== 'https:') {
              throw new Error('Media URL must use HTTPS');
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Invalid media URL';
            await logNode(flowId, payload, node, 'failed', undefined, message, Date.now() - start);
            return { done: false, nextNodeId: node.next || null, waitingFor: null };
          }
          const mediaTypeMap = {
            image: 'IMAGE',
            video: 'VIDEO',
            document: 'DOCUMENT',
            audio: 'AUDIO',
          } as const;
          const mediaType: DeliverMessageType =
            mediaTypeMap[node.mediaType || 'image'] || 'IMAGE';
          await sendFlowMessage(payload, node.mediaCaption || node.text || '', state.variables, contactName, mediaType, {
            mediaUrl: node.mediaUrl,
            mediaCaption: node.mediaCaption,
          });
        }
        await logNode(flowId, payload, node, 'success', undefined, undefined, Date.now() - start);
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'delay':
      case 'schedule': {
        let delayMs = Math.min((node.delaySeconds || 5) * 1000, 86400000);
        if (node.type === 'schedule' && node.scheduleAt) {
          const target = new Date(node.scheduleAt).getTime();
          const diff = target - Date.now();
          if (diff > 0) delayMs = Math.min(diff, 7 * 86400000);
        }
        state.waitingFor = 'delay';
        state.resumeAt = new Date(Date.now() + delayMs).toISOString();
        await saveFlowState(payload.conversationId, state, payload);
        await cancelFlowDelayJob(payload.conversationId);
        await flowQueue.add(
          'resume-flow',
          {
            conversationId: payload.conversationId,
            organizationId: payload.organizationId,
            flowId,
            nextNodeId: node.next,
            contactId: payload.contactId,
            whatsappNumberId: payload.whatsappNumberId,
          },
          { delay: delayMs, jobId: flowDelayJobId(payload.conversationId) }
        );
        await logNode(
          flowId,
          payload,
          node,
          'success',
          node.type === 'schedule' ? { scheduleAt: node.scheduleAt, delayMs } : { delaySeconds: node.delaySeconds },
          undefined,
          Date.now() - start
        );
        return { done: false, nextNodeId: null, waitingFor: 'delay' };
      }

      case 'webhook': {
        const result = await callWebhook(node, payload, state.variables);
        await logNode(
          flowId,
          payload,
          node,
          result?.ok === false ? 'failed' : 'success',
          { url: redactedWebhookUrl(node.webhookUrl), status: result?.status },
          result?.ok === false ? `Webhook returned ${result?.status}` : undefined,
          Date.now() - start
        );
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'goto_step': {
        const nextId = node.targetNodeId || node.next || null;
        await logNode(flowId, payload, node, 'success', { targetNodeId: nextId }, undefined, Date.now() - start);
        return { done: false, nextNodeId: nextId, waitingFor: null };
      }

      case 'location': {
        if (node.latitude != null && node.longitude != null) {
          const intro = node.text?.trim();
          if (intro) {
            await sendFlowMessage(payload, intro, state.variables, contactName, 'TEXT', { flowId });
          }
          await sendFlowMessage(
            payload,
            node.locationName || 'Our location',
            state.variables,
            contactName,
            'LOCATION',
            {
              flowId,
              location: {
                latitude: node.latitude,
                longitude: node.longitude,
                name: node.locationName,
                address: node.locationAddress,
              },
            }
          );
        }
        await logNode(flowId, payload, node, 'success', undefined, undefined, Date.now() - start);
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'contact_card': {
        if (node.contactName && node.contactPhone) {
          const intro = node.text?.trim();
          if (intro) {
            await sendFlowMessage(payload, intro, state.variables, contactName, 'TEXT', { flowId });
          }
          await sendFlowMessage(payload, node.contactName, state.variables, contactName, 'CONTACTS', {
            flowId,
            contacts: [{ name: node.contactName, phone: node.contactPhone, email: node.contactEmail }],
          });
        } else {
          await logNode(
            flowId,
            payload,
            node,
            'failed',
            undefined,
            'Contact name and phone are required',
            Date.now() - start
          );
          return { done: false, nextNodeId: node.next || null, waitingFor: null };
        }
        await logNode(flowId, payload, node, 'success', undefined, undefined, Date.now() - start);
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'wa_flow': {
        if (node.waFlowId) {
          const { mintNfmFlowToken } = await import('../flows-assets/nfm-token');
          const flowToken = mintNfmFlowToken({
            conversationId: payload.conversationId,
            nodeId: node.id,
          });
          await sendFlowMessage(payload, node.text || 'Please complete the form', state.variables, contactName, 'INTERACTIVE', {
            flowId,
            waFlow: {
              flowId: node.waFlowId,
              flowToken,
              cta: (node.waFlowCta || 'Open form').slice(0, 20),
              screen: node.waFlowScreen,
              body: node.text,
            },
          });
          state.variables._last_wa_flow_token = flowToken;
          await logNode(flowId, payload, node, 'success', { waFlowId: node.waFlowId }, undefined, Date.now() - start);
          return { done: false, nextNodeId: null, waitingFor: 'wa_flow' };
        }
        await logNode(flowId, payload, node, 'failed', undefined, 'No form selected', Date.now() - start);
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'ab_split': {
        const ratio = Math.min(Math.max(node.splitRatio ?? 50, 1), 99) / 100;
        const stickyKey = `${flowId}:${node.id}`;
        const sticky = state.abSticky?.[stickyKey];
        const branchKey: 'a' | 'b' =
          sticky === 'a' || sticky === 'b' ? sticky : Math.random() < ratio ? 'a' : 'b';
        if (!sticky) {
          state.abSticky = { ...state.abSticky, [stickyKey]: branchKey };
        }
        const nextId = node.branches?.[branchKey] || node.next || null;
        await logNode(flowId, payload, node, 'success', { branch: branchKey, sticky: Boolean(sticky) }, undefined, Date.now() - start);
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
    const skippedCsw = isCswClosedError(err);
    await logNode(
      flowId,
      payload,
      node,
      skippedCsw ? 'skipped' : 'failed',
      skippedCsw ? { reason: 'csw_closed', metaCode: 131047 } : undefined,
      err instanceof Error ? err.message : String(err),
      Date.now() - start
    );
    if (skippedCsw) {
      return { done: true, nextNodeId: null, waitingFor: null };
    }
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
  contactTags?: string[],
  executionContext?: FlowExecutionContext
): Promise<boolean> {
  let currentId: string | null = startNodeId;
  let iterations = 0;
  const currentContext = executionContext || {
    flowPath: new Set(
      state.flowPath?.length
        ? state.flowPath
        : [flowId]
    ),
    flowHops: state.flowHops || 0,
  };

  while (currentId && iterations < 50) {
    iterations++;
    const liveConversation = await prisma.conversation.findFirst({
      where: {
        id: payload.conversationId,
        organizationId: payload.organizationId,
        whatsappNumberId: payload.whatsappNumberId,
      },
      select: { botActive: true, botHandoffAt: true },
    });
    if (!liveConversation || isBotPaused(liveConversation) || liveConversation.botHandoffAt) {
      await saveFlowState(payload.conversationId, null, payload);
      return true;
    }

    const node = findNode(nodes, currentId);
    if (!node) {
      log.warn('Flow node not found — likely deleted after publish. Clearing state.', {
        flowId,
        missingNodeId: currentId,
        conversationId: payload.conversationId,
      });
      await incrementFlowStat(flowId, 'dropoffs', currentId);
      await logAutomationRun({
        organizationId: payload.organizationId,
        conversationId: payload.conversationId,
        flowId,
        triggerType: 'FLOW',
        action: `node:missing`,
        status: 'failed',
        error: `Node '${currentId}' no longer exists in published flow.`,
      });
      await saveFlowState(payload.conversationId, null, payload);
      return true;
    }

    state.currentNodeId = currentId;
    const result = await executeNode(
      payload,
      flowId,
      node,
      state,
      contactName,
      contactTags,
      currentContext
    );

    if (result.waitingFor) {
      state.waitingFor = result.waitingFor;
      if (result.waitingFor !== 'delay') await saveFlowState(payload.conversationId, state, payload);
      return true;
    }

    state.waitingFor = null;
    currentId = result.nextNodeId;

    if (result.done) {
      await saveFlowState(payload.conversationId, null, payload);
      return true;
    }
  }

  if (iterations >= 50) {
    log.warn('Flow iteration limit exceeded', { flowId, conversationId: payload.conversationId });
    await incrementFlowStat(flowId, 'dropoffs', state.currentNodeId);
  }

  await saveFlowState(payload.conversationId, null, payload);
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
    case 'CAMPAIGN_REPLY':
      return (
        Boolean(payload.content) &&
        (await hasRecentCampaignMessage(
          payload.conversationId,
          config.campaignId,
          config.withinHours ?? 168
        ))
      );
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
    where: { organizationId, ...scopedLiveFlowWhere(payload.whatsappNumberId) },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  const { primary, catchAll } = partitionFlowsForMatch(flows);

  for (const flow of [...primary, ...catchAll]) {
    if (!(await flowMatchesTrigger(flow, payload, withinHours, contactTags))) continue;
    if (
      await skipCappedFlowStart({
        organizationId,
        conversationId: payload.conversationId,
        flowId: flow.id,
      })
    ) {
      continue;
    }
    return {
      id: flow.id,
      name: flow.name,
      nodes: parseNodes(flow.nodes),
      startNodeId: flow.startNodeId,
    };
  }

  return null;
}

function applyLanguageFromMessage(state: FlowState, content?: string): void {
  if (!content?.trim() || state.variables.language) return;
  state.variables.language = detectMessageLanguage(content);
}

function seedAbSticky(state: FlowState, botState: unknown): void {
  const sticky = extractAbSticky(botState);
  if (Object.keys(sticky).length) state.abSticky = { ...sticky, ...state.abSticky };
}

function validateAnswer(field: string, value: string): boolean {
  if (field === 'email') return isValidEmail(value);
  if (field === 'phone') return isValidPhone(value);
  if (field === 'name') return value.trim().length >= 2;
  return value.trim().length > 0;
}

async function recoverFlowFromButtonReply(
  payload: InboundFlowPayload,
  contactName?: string | null,
  contactTags?: string[],
  botState?: unknown
): Promise<boolean> {
  if (!payload.buttonReplyId) return false;

  const recent = await prisma.message.findFirst({
    where: {
      conversationId: payload.conversationId,
      direction: 'OUTBOUND',
      type: 'INTERACTIVE',
      createdAt: { gte: new Date(Date.now() - 24 * 3600000) },
      conversation: {
        organizationId: payload.organizationId,
        whatsappNumberId: payload.whatsappNumberId,
      },
    },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  });

  const meta = recent?.metadata as Record<string, unknown> | null;
  const flowId = meta?.flowId as string | undefined;
  if (!flowId) return false;

  const flow = await prisma.flow.findFirst({
    where: {
      id: flowId,
      organizationId: payload.organizationId,
      ...scopedLiveFlowWhere(payload.whatsappNumberId),
    },
  });
  if (!flow) return false;

  if (
    await skipCappedFlowStart({
      organizationId: payload.organizationId,
      conversationId: payload.conversationId,
      flowId: flow.id,
    })
  ) {
    return false;
  }

  const nodes = parseNodes(flow.nodes);
  const menuNode = nodes.find(
    (n) =>
      (n.type === 'buttons' &&
        n.buttons?.some((b) => b.id === payload.buttonReplyId || b.id.trim() === payload.buttonReplyId?.trim())) ||
      (n.type === 'list' &&
        n.listSections?.some((s) =>
          s.rows.some((r) => r.id === payload.buttonReplyId || r.id.trim() === payload.buttonReplyId?.trim())
        ))
  );
  if (!menuNode) return false;

  const nextId = resolveNextNode(menuNode, payload.buttonReplyId, payload.content);
  if (!nextId || !findNode(nodes, nextId)) return false;

  const state: FlowState = {
    flowId: flow.id,
    flowName: flow.name,
    currentNodeId: nextId,
    waitingFor: null,
    variables: {},
    attempts: 0,
  };
  if (contactName) state.variables.name = contactName;
  seedAbSticky(state, botState);

  log.info('Recovering flow from button reply', {
    flowId: flow.id,
    conversationId: payload.conversationId,
    buttonReplyId: payload.buttonReplyId,
    nextId,
  });

  return runFromNode(payload, flow.id, nodes, nextId, state, contactName, contactTags);
}

async function processInboundFlow(payload: InboundFlowPayload): Promise<boolean> {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: payload.conversationId,
      organizationId: payload.organizationId,
      whatsappNumberId: payload.whatsappNumberId,
      contactId: payload.contactId,
    },
    include: { contact: true },
  });

  if (!conversation) return false;
  if (isBotPaused(conversation)) return false;
  if (conversation.botHandoffAt) return false;
  if (conversation.assignedAgentId && conversation.status !== 'OPEN') return false;

  if (
    await skipIfOptedOut(
      payload.organizationId,
      payload.contactId,
      payload.conversationId,
      payload.whatsappNumberId
    )
  ) {
    return false;
  }

  const contactTags = conversation.contact?.tags || [];

  if (payload.content && wantsHandoff(payload.content)) {
    const existingHandoffState = getFlowState(conversation.botState);
    if (existingHandoffState) {
      await cancelFlowDelayJob(payload.conversationId);
      await saveFlowState(payload.conversationId, null, payload);
      await performHandoff(payload.organizationId, payload.conversationId, 'USER_REQUEST');
      return true;
    }
  }

  let existingState = getFlowState(conversation.botState);

  let delayInterruptOnInbound: boolean | undefined;
  if (existingState?.waitingFor === 'delay') {
    const delayFlow = await prisma.flow.findFirst({
      where: {
        id: existingState.flowId,
        organizationId: payload.organizationId,
        ...scopedLiveFlowWhere(payload.whatsappNumberId),
      },
      select: { nodes: true },
    });
    const delayNode = delayFlow
      ? findNode(parseNodes(delayFlow.nodes), existingState.currentNodeId)
      : undefined;
    delayInterruptOnInbound = delayNode?.interruptOnInbound;
  }

  if (
    existingState &&
    shouldInterruptWait(existingState.waitingFor, payload, {
      interruptOnInbound: delayInterruptOnInbound,
    })
  ) {
    if (existingState.waitingFor === 'delay') {
      await cancelFlowDelayJob(payload.conversationId);
    }
    await logAutomationRun({
      organizationId: payload.organizationId,
      conversationId: payload.conversationId,
      flowId: existingState.flowId,
      triggerType: 'FLOW',
      action: existingState.waitingFor === 'delay' ? 'delay_interrupted' : 'form_wait_interrupted',
      status: 'skipped',
      output: { reason: 'inbound_during_wait' },
    });
    await saveFlowState(payload.conversationId, null, payload);
    existingState = null;
  }

  if (existingState) {
    applyLanguageFromMessage(existingState, payload.content);

    const flow = await prisma.flow.findFirst({
      where: {
        id: existingState.flowId,
        organizationId: payload.organizationId,
        ...scopedLiveFlowWhere(payload.whatsappNumberId),
      },
    });
    if (!flow) {
      await cancelFlowDelayJob(payload.conversationId);
      await saveFlowState(payload.conversationId, null, payload);
      return false;
    }

    const nodes = parseNodes(flow.nodes);
    const currentNode = findNode(nodes, existingState.currentNodeId);
    if (!currentNode) {
      await saveFlowState(payload.conversationId, null, payload);
      return false;
    }

    if (existingState.waitingFor === 'button') {
      if (payload.buttonReplyId || payload.content?.trim()) {
        let nextId = resolveNextNode(
          currentNode,
          payload.buttonReplyId,
          payload.content
        );

        if (!nextId && !payload.buttonReplyId && payload.content) {
          nextId = matchTextIntent(currentNode, payload.content);
        }

        if (nextId) {
          const targetNode = findNode(nodes, nextId);
          if (!targetNode) {
            log.warn('Flow button branch target missing', {
              flowId: flow.id,
              nodeId: currentNode.id,
              nextId,
            });
            await sendFlowMessage(
              payload,
              'Something went wrong with that option. Please try another button or type help.',
              existingState.variables,
              conversation.contact?.name
            );
            await saveFlowState(payload.conversationId, existingState, payload);
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

        if (payload.buttonReplyId) {
          log.warn('Flow button branch not found', {
            flowId: flow.id,
            nodeId: currentNode.id,
            buttonReplyId: payload.buttonReplyId,
            content: payload.content,
            branches: currentNode.branches,
            buttons: currentNode.buttons?.map((b) => b.id),
          });
          await sendFlowMessage(
            payload,
            'That option is not set up yet. Please tap one of the other buttons above.',
            existingState.variables,
            conversation.contact?.name
          );
        } else {
          await sendFlowMessage(
            payload,
            'Please tap one of the buttons above to continue. 👆',
            existingState.variables,
            conversation.contact?.name
          );
        }
        await saveFlowState(payload.conversationId, existingState, payload);
        return true;
      }

      return true;
    }

    if (existingState.waitingFor === 'wa_flow') {
      if (payload.waFlowResponse && Object.keys(payload.waFlowResponse).length > 0) {
        for (const [key, value] of Object.entries(payload.waFlowResponse)) {
          if (key.startsWith('_')) continue;
          existingState.variables[`form_${key}`] = String(value ?? '');
        }
        existingState.variables._form_response = JSON.stringify(payload.waFlowResponse);
        existingState.waitingFor = null;
        existingState.attempts = 0;
        const nextId = currentNode.next;
        if (!nextId) {
          await saveFlowState(payload.conversationId, null, payload);
          return true;
        }
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
      log.info('Meta Form wait with no form payload; treating as interrupt miss', {
        conversationId: payload.conversationId,
        flowId: flow.id,
      });
    }

    if (existingState.waitingFor === 'text' && (payload.content || payload.hasMedia)) {
      const field = currentNode.field || 'custom';
      const fieldKey = field === 'custom' ? (currentNode.customField || 'answer') : field;
      const maxRetries = currentNode.maxRetries ?? 2;

      const answerValue = payload.hasMedia
        ? `[${payload.messageType || 'media'}]`
        : payload.content;

      if (currentNode.acceptMedia && payload.hasMedia) {
        existingState.variables[fieldKey] = answerValue;
        existingState.attempts = 0;
        const nextId = currentNode.next;
        if (!nextId) {
          await saveFlowState(payload.conversationId, null, payload);
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
          await saveFlowState(payload.conversationId, null, payload);
          return true;
        }
        await sendFlowMessage(
          payload,
          currentNode.retryMessage || 'Please try again with a valid response.',
          existingState.variables,
          conversation.contact?.name
        );
        await saveFlowState(payload.conversationId, existingState, payload);
        return true;
      }

      existingState.variables[fieldKey] = payload.content;
      existingState.attempts = 0;
      await updateContactField(payload, fieldKey, payload.content);

      const nextId = currentNode.next;
      if (!nextId) {
        await saveFlowState(payload.conversationId, null, payload);
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

  if (hasWaFlowResponse(payload)) {
    log.info('Ignoring NFM reply with no waiting form', {
      conversationId: payload.conversationId,
    });
    return true;
  }

  if (payload.buttonReplyId) {
    const recovered = await recoverFlowFromButtonReply(
      payload,
      conversation.contact?.name,
      contactTags,
      conversation.botState
    );
    if (recovered) return true;
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
  seedAbSticky(state, conversation.botState);
  applyLanguageFromMessage(state, payload.content);

  await recordFlowStart({
    organizationId: payload.organizationId,
    conversationId: payload.conversationId,
    flowId: matched.id,
  });
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

export async function handleInboundFlow(payload: InboundFlowPayload): Promise<HandleInboundFlowResult> {
  const result = await withConversationLock(payload.conversationId, () => processInboundFlow(payload));
  if (result === null) return FLOW_LOCK_BUSY;
  return result;
}

export async function resumeFlowAfterDelay(jobData: {
  conversationId: string;
  organizationId: string;
  flowId: string;
  nextNodeId: string | null;
  contactId: string;
  whatsappNumberId: string;
}): Promise<void> {
  const nextNodeId = jobData.nextNodeId;
  if (!nextNodeId) {
    await saveFlowState(jobData.conversationId, null, jobData);
    return;
  }

  await withConversationLock(jobData.conversationId, async () => {
    try {
      await getActiveWhatsappNumberCredentials(
        jobData.organizationId,
        jobData.whatsappNumberId
      );
    } catch {
      await saveFlowState(jobData.conversationId, null, jobData);
      return;
    }

    const flow = await prisma.flow.findFirst({
      where: {
        id: jobData.flowId,
        organizationId: jobData.organizationId,
        ...scopedLiveFlowWhere(jobData.whatsappNumberId),
      },
    });
    if (!flow) {
      await saveFlowState(jobData.conversationId, null, jobData);
      return;
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: jobData.conversationId, organizationId: jobData.organizationId },
      include: { contact: true },
    });
    if (!conversation || conversation.botHandoffAt) return;
    if (isBotPaused(conversation)) {
      await saveFlowState(jobData.conversationId, null, jobData);
      return;
    }

    if (
      await skipIfOptedOut(
        jobData.organizationId,
        jobData.contactId,
        jobData.conversationId,
      jobData.whatsappNumberId,
        jobData.flowId
      )
    ) {
      return;
    }

    const latest = await prisma.conversation.findFirst({
      where: { id: jobData.conversationId, organizationId: jobData.organizationId },
      include: { contact: true },
    });
    if (
      !latest ||
      latest.botHandoffAt ||
      isBotPaused(latest) ||
      latest.whatsappNumberId !== jobData.whatsappNumberId ||
      latest.contactId !== jobData.contactId ||
      !latest.contact
    ) {
      return;
    }

    const state = getFlowState(latest.botState);
    if (!state || state.flowId !== jobData.flowId) return;
    if (state.waitingFor !== 'delay') return;

    state.waitingFor = null;
    const payload: InboundFlowPayload = {
      organizationId: jobData.organizationId,
      conversationId: jobData.conversationId,
      contactId: jobData.contactId,
      messageId: `flow-resume-${jobData.flowId}-${nextNodeId}`,
      contactPhone: latest.contact.phone,
      whatsappNumberId: jobData.whatsappNumberId,
      content: '',
      isNewConversation: false,
    };

    await runFromNode(
      payload,
      jobData.flowId,
      parseNodes(flow.nodes),
      nextNodeId,
      state,
      latest.contact?.name,
      latest.contact?.tags || []
    );
  });
}

export async function triggerMissedCallFlow(params: {
  organizationId: string;
  conversationId: string;
  contactId: string;
  whatsappNumberId: string;
}): Promise<boolean> {
  const flows = await prisma.flow.findMany({
    where: {
      organizationId: params.organizationId,
      ...scopedLiveFlowWhere(params.whatsappNumberId),
      triggerType: 'MISSED_CALL',
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  if (flows.length === 0) return false;

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: params.conversationId,
      organizationId: params.organizationId,
      whatsappNumberId: params.whatsappNumberId,
      contactId: params.contactId,
    },
    include: { contact: true },
  });
  if (!conversation || conversation.botHandoffAt || isBotPaused(conversation)) return false;

  for (const flow of flows) {
    const nodes = parseNodes(flow.nodes);
    const startNode = getStartNode(nodes, flow.startNodeId);
    if (!startNode) continue;

    if (
      await skipIfOptedOut(
        params.organizationId,
        params.contactId,
        params.conversationId,
        params.whatsappNumberId,
        flow.id
      )
    ) {
      return true;
    }

    if (
      await skipCappedFlowStart({
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        flowId: flow.id,
      })
    ) {
      continue;
    }

    const state: FlowState = {
      flowId: flow.id,
      flowName: flow.name,
      currentNodeId: startNode.id,
      waitingFor: null,
      variables: {},
      attempts: 0,
    };
    if (conversation.contact?.name) state.variables.name = conversation.contact.name;
    seedAbSticky(state, conversation.botState);

    const payload: InboundFlowPayload = {
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      contactId: params.contactId,
      messageId: '',
      contactPhone: conversation.contact.phone,
      whatsappNumberId: params.whatsappNumberId,
      content: '',
      isNewConversation: false,
    };

    log.info('Starting missed-call flow', { flowId: flow.id, conversationId: params.conversationId });

    return withConversationLock(params.conversationId, async () => {
      await recordFlowStart({
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        flowId: flow.id,
      });
      await runFromNode(
        payload,
        flow.id,
        nodes,
        startNode.id,
        state,
        conversation.contact?.name,
        conversation.contact?.tags || []
      );
      return true;
    }).then((r) => r ?? false);
  }

  return false;
}

async function triggerEventFlow(
  triggerType: 'CALL_COMPLETED',
  params: {
    organizationId: string;
    conversationId: string;
    contactId: string;
    whatsappNumberId: string;
  }
): Promise<boolean> {
  const flows = await prisma.flow.findMany({
    where: {
      organizationId: params.organizationId,
      ...scopedLiveFlowWhere(params.whatsappNumberId),
      triggerType,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });
  if (flows.length === 0) return false;

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: params.conversationId,
      organizationId: params.organizationId,
      whatsappNumberId: params.whatsappNumberId,
      contactId: params.contactId,
    },
    include: { contact: true },
  });
  if (!conversation || conversation.botHandoffAt || isBotPaused(conversation)) return false;

  for (const flow of flows) {
    const nodes = parseNodes(flow.nodes);
    const startNode = getStartNode(nodes, flow.startNodeId);
    if (!startNode) continue;

    if (
      await skipIfOptedOut(
        params.organizationId,
        params.contactId,
        params.conversationId,
        params.whatsappNumberId,
        flow.id
      )
    ) {
      return true;
    }

    if (
      await skipCappedFlowStart({
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        flowId: flow.id,
      })
    ) {
      continue;
    }

    const state: FlowState = {
      flowId: flow.id,
      flowName: flow.name,
      currentNodeId: startNode.id,
      waitingFor: null,
      variables: {},
      attempts: 0,
    };
    if (conversation.contact?.name) state.variables.name = conversation.contact.name;
    seedAbSticky(state, conversation.botState);

    const payload: InboundFlowPayload = {
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      contactId: params.contactId,
      messageId: '',
      contactPhone: conversation.contact.phone,
      whatsappNumberId: params.whatsappNumberId,
      content: '',
      isNewConversation: false,
    };

    log.info('Starting event flow', { flowId: flow.id, triggerType, conversationId: params.conversationId });

    return withConversationLock(params.conversationId, async () => {
      await recordFlowStart({
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        flowId: flow.id,
      });
      await runFromNode(
        payload,
        flow.id,
        nodes,
        startNode.id,
        state,
        conversation.contact?.name,
        conversation.contact?.tags || []
      );
      return true;
    }).then((r) => r ?? false);
  }

  return false;
}

export async function triggerCallCompletedFlow(params: {
  organizationId: string;
  conversationId: string;
  contactId: string;
  whatsappNumberId: string;
}): Promise<boolean> {
  return triggerEventFlow('CALL_COMPLETED', params);
}

export async function scheduleFlowStart(params: {
  organizationId: string;
  flowId: string;
  conversationId: string;
  contactId: string;
  whatsappNumberId: string;
  delayMs: number;
  isNewConversation?: boolean;
}): Promise<void> {
  await flowQueue.add(
    'start-flow',
    {
      organizationId: params.organizationId,
      flowId: params.flowId,
      conversationId: params.conversationId,
      contactId: params.contactId,
      whatsappNumberId: params.whatsappNumberId,
      isNewConversation: params.isNewConversation ?? false,
    },
    {
      delay: Math.min(Math.max(params.delayMs, 0), 7 * 86400000),
      jobId: `flow-start-${params.conversationId}-${params.flowId}-${Date.now()}`,
    }
  );
}

export async function startFlowFromJob(jobData: {
  organizationId: string;
  flowId: string;
  conversationId: string;
  contactId: string;
  whatsappNumberId: string;
  isNewConversation: boolean;
}): Promise<void> {
  try {
    await getActiveWhatsappNumberCredentials(jobData.organizationId, jobData.whatsappNumberId);
  } catch {
    return;
  }

  const flow = await prisma.flow.findFirst({
    where: {
      id: jobData.flowId,
      organizationId: jobData.organizationId,
      ...scopedLiveFlowWhere(jobData.whatsappNumberId),
    },
  });
  if (!flow) return;

  const nodes = parseNodes(flow.nodes);
  const startNode = getStartNode(nodes, flow.startNodeId);
  if (!startNode) return;

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: jobData.conversationId,
      organizationId: jobData.organizationId,
      whatsappNumberId: jobData.whatsappNumberId,
      contactId: jobData.contactId,
    },
    include: { contact: true },
  });
  if (!conversation || conversation.botHandoffAt || isBotPaused(conversation) || !conversation.contact) return;

  if (
    await skipIfOptedOut(
      jobData.organizationId,
      jobData.contactId,
      jobData.conversationId,
      jobData.whatsappNumberId,
      flow.id
    )
  ) {
    return;
  }

  if (
    await skipCappedFlowStart({
      organizationId: jobData.organizationId,
      conversationId: jobData.conversationId,
      flowId: flow.id,
    })
  ) {
    return;
  }

  const state: FlowState = {
    flowId: flow.id,
    flowName: flow.name,
    currentNodeId: startNode.id,
    waitingFor: null,
    variables: {},
    attempts: 0,
  };
  if (conversation.contact?.name) state.variables.name = conversation.contact.name;
  seedAbSticky(state, conversation.botState);

  const payload: InboundFlowPayload = {
    organizationId: jobData.organizationId,
    conversationId: jobData.conversationId,
    contactId: jobData.contactId,
    messageId: '',
    contactPhone: conversation.contact.phone,
    whatsappNumberId: jobData.whatsappNumberId,
    content: '',
    isNewConversation: jobData.isNewConversation,
  };

  await withConversationLock(jobData.conversationId, async () => {
    await recordFlowStart({
      organizationId: jobData.organizationId,
      conversationId: jobData.conversationId,
      flowId: flow.id,
    });
    await runFromNode(
      payload,
      flow.id,
      nodes,
      startNode.id,
      state,
      conversation.contact?.name,
      conversation.contact?.tags || []
    );
  });
}
