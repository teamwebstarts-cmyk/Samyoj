import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { deliverOutboundMessage, toDbMessageType, type DeliverMessageType } from '../messages/send.service';
import { logAutomationRun, performHandoff } from '../ai/chatbot.service';
import { queueAiBotProcessing } from '../automation/engine';
import { getOrgBusinessHours, isWithinBusinessHours } from '../settings/business-hours';
import { flowQueue } from '../../config/queues';
import { createModuleLogger } from '../../utils/logger';
import { withConversationLock } from './lock';
import { incrementFlowStat } from './analytics';
import { detectMessageLanguage } from './language';
import { normalizePhoneIdentity } from '../../utils/phone';
import { linkFlowNodes } from './link-nodes';
import { matchInteractiveTextIntent, resolveInteractiveBranch, syncButtonNode } from './branch-resolve';
import type { InteractiveMessageOptions } from '../messages/interactive';
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
  const synced = (raw as FlowNode[]).map((node) => syncButtonNode(node));
  return linkFlowNodes(synced);
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

function resolveNextNode(node: FlowNode, buttonReplyId?: string, buttonTitle?: string): string | null {
  return resolveInteractiveBranch(node, buttonReplyId, buttonTitle);
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

function matchTextIntent(node: FlowNode, content: string): string | null {
  return matchInteractiveTextIntent(node, content);
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
  type: DeliverMessageType = 'TEXT',
  options?: {
    buttons?: Array<{ id: string; title: string }>;
    interactive?: InteractiveMessageOptions;
    templateName?: string;
    templateLanguage?: string;
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
    messageId: msg.id,
    phoneNumberId: payload.phoneNumberId,
    encryptedToken: payload.encryptedToken,
    to: payload.contactPhone,
    content: rendered,
    type: options?.waFlow ? 'INTERACTIVE' : type,
    buttons: options?.buttons,
    interactive: options?.interactive,
    templateName: options?.templateName,
    templateLanguage: options?.templateLanguage,
    location: options?.location,
    contacts: options?.contacts,
    waFlow: options?.waFlow,
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
    const clean = normalizePhoneIdentity(value);
    await prisma.contact.update({
      where: { id: contactId },
      data: { phone: clean, normalizedPhone: clean },
    });
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

async function removeContactTag(contactId: string, tag: string): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact || !contact.tags.includes(tag)) return;
  await prisma.contact.update({
    where: { id: contactId },
    data: { tags: contact.tags.filter((t) => t !== tag) },
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

  const res = await fetch(node.webhookUrl, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text().catch(() => '');
  variables.webhook_status = String(res.status);
  variables.webhook_ok = res.ok ? 'true' : 'false';
  variables.webhook_body = text.slice(0, 2000);
  if (node.webhookVariable) {
    variables[node.webhookVariable] = text.slice(0, 500);
  }
  return { ok: res.ok, status: res.status, body: text };
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
        if (node.tag) await addContactTag(payload.contactId, node.tag);
        await logNode(flowId, payload, node, 'success', { tag: node.tag }, undefined, Date.now() - start);
        return { done: false, nextNodeId: node.next || null, waitingFor: null };
      }

      case 'remove_tag': {
        if (node.tag) await removeContactTag(payload.contactId, node.tag);
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
          where: { id: node.targetFlowId, organizationId: payload.organizationId, enabled: true, status: 'PUBLISHED' },
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
        state.flowId = target.id;
        state.currentNodeId = targetStart.id;
        state.waitingFor = null;
        await incrementFlowStat(target.id, 'starts');
        await logNode(flowId, payload, node, 'success', { targetFlowId: target.id }, undefined, Date.now() - start);
        await runFromNode(payload, target.id, targetNodes, targetStart.id, state, contactName, contactTags);
        return { done: true, nextNodeId: null, waitingFor: null };
      }

      case 'request_callback': {
        const callbackTag = node.callbackTag || 'callback-requested';
        await addContactTag(payload.contactId, callbackTag);
        if (node.text) {
          await sendFlowMessage(payload, node.text, state.variables, contactName, 'TEXT', { flowId });
        }
        if (node.assignAgentId) {
          await assignToAgent(
            payload.organizationId,
            payload.conversationId,
            node.assignAgentId === '*' ? undefined : node.assignAgentId
          );
        }
        await logNode(flowId, payload, node, 'success', { tag: callbackTag }, undefined, Date.now() - start);
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
          { url: node.webhookUrl, status: result?.status },
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
          const { randomUUID } = await import('crypto');
          const flowToken = `${payload.conversationId}:${node.id}:${randomUUID()}`;
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
        const branchKey = Math.random() < ratio ? 'a' : 'b';
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

  while (currentId && iterations < 50) {
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

  if (iterations >= 50) {
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

async function recoverFlowFromButtonReply(
  payload: InboundFlowPayload,
  contactName?: string | null,
  contactTags?: string[]
): Promise<boolean> {
  if (!payload.buttonReplyId) return false;

  const recent = await prisma.message.findFirst({
    where: {
      conversationId: payload.conversationId,
      direction: 'OUTBOUND',
      type: 'INTERACTIVE',
      createdAt: { gte: new Date(Date.now() - 24 * 3600000) },
    },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  });

  const meta = recent?.metadata as Record<string, unknown> | null;
  const flowId = meta?.flowId as string | undefined;
  if (!flowId) return false;

  const flow = await prisma.flow.findFirst({
    where: { id: flowId, organizationId: payload.organizationId, enabled: true },
  });
  if (!flow) return false;

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
            await saveFlowState(payload.conversationId, existingState);
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
        await saveFlowState(payload.conversationId, existingState);
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
          await saveFlowState(payload.conversationId, null);
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
      return true;
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

  if (payload.buttonReplyId) {
    const recovered = await recoverFlowFromButtonReply(
      payload,
      conversation.contact?.name,
      contactTags
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

export async function triggerMissedCallFlow(params: {
  organizationId: string;
  conversationId: string;
  contactId: string;
  contactPhone: string;
  phoneNumberId: string;
  encryptedToken: string;
}): Promise<boolean> {
  const flows = await prisma.flow.findMany({
    where: {
      organizationId: params.organizationId,
      enabled: true,
      status: 'PUBLISHED',
      triggerType: 'MISSED_CALL',
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  if (flows.length === 0) return false;

  const flow = flows[0];
  const nodes = parseNodes(flow.nodes);
  const startNode = getStartNode(nodes, flow.startNodeId);
  if (!startNode) return false;

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.conversationId, organizationId: params.organizationId },
    include: { contact: true },
  });
  if (!conversation || conversation.botHandoffAt) return false;

  const state: FlowState = {
    flowId: flow.id,
    flowName: flow.name,
    currentNodeId: startNode.id,
    waitingFor: null,
    variables: {},
    attempts: 0,
  };
  if (conversation.contact?.name) state.variables.name = conversation.contact.name;

  const payload: InboundFlowPayload = {
    organizationId: params.organizationId,
    conversationId: params.conversationId,
    contactId: params.contactId,
    messageId: '',
    contactPhone: params.contactPhone,
    phoneNumberId: params.phoneNumberId,
    encryptedToken: params.encryptedToken,
    content: '',
    isNewConversation: false,
  };

  await incrementFlowStat(flow.id, 'starts');
  log.info('Starting missed-call flow', { flowId: flow.id, conversationId: params.conversationId });

  return withConversationLock(params.conversationId, async () => {
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

async function triggerEventFlow(
  triggerType: 'CALL_COMPLETED',
  params: {
    organizationId: string;
    conversationId: string;
    contactId: string;
    contactPhone: string;
    phoneNumberId: string;
    encryptedToken: string;
  }
): Promise<boolean> {
  const flows = await prisma.flow.findMany({
    where: {
      organizationId: params.organizationId,
      enabled: true,
      status: 'PUBLISHED',
      triggerType,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });
  if (flows.length === 0) return false;

  const flow = flows[0];
  const nodes = parseNodes(flow.nodes);
  const startNode = getStartNode(nodes, flow.startNodeId);
  if (!startNode) return false;

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.conversationId, organizationId: params.organizationId },
    include: { contact: true },
  });
  if (!conversation || conversation.botHandoffAt) return false;

  const state: FlowState = {
    flowId: flow.id,
    flowName: flow.name,
    currentNodeId: startNode.id,
    waitingFor: null,
    variables: {},
    attempts: 0,
  };
  if (conversation.contact?.name) state.variables.name = conversation.contact.name;

  const payload: InboundFlowPayload = {
    organizationId: params.organizationId,
    conversationId: params.conversationId,
    contactId: params.contactId,
    messageId: '',
    contactPhone: params.contactPhone,
    phoneNumberId: params.phoneNumberId,
    encryptedToken: params.encryptedToken,
    content: '',
    isNewConversation: false,
  };

  await incrementFlowStat(flow.id, 'starts');
  log.info('Starting event flow', { flowId: flow.id, triggerType, conversationId: params.conversationId });

  return withConversationLock(params.conversationId, async () => {
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

export async function triggerCallCompletedFlow(params: {
  organizationId: string;
  conversationId: string;
  contactId: string;
  contactPhone: string;
  phoneNumberId: string;
  encryptedToken: string;
}): Promise<boolean> {
  return triggerEventFlow('CALL_COMPLETED', params);
}

export async function scheduleFlowStart(params: {
  organizationId: string;
  flowId: string;
  conversationId: string;
  contactId: string;
  contactPhone: string;
  phoneNumberId: string;
  encryptedToken: string;
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
      contactPhone: params.contactPhone,
      phoneNumberId: params.phoneNumberId,
      encryptedToken: params.encryptedToken,
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
  contactPhone: string;
  phoneNumberId: string;
  encryptedToken: string;
  isNewConversation: boolean;
}): Promise<void> {
  const flow = await prisma.flow.findFirst({
    where: { id: jobData.flowId, organizationId: jobData.organizationId, enabled: true, status: 'PUBLISHED' },
  });
  if (!flow) return;

  const nodes = parseNodes(flow.nodes);
  const startNode = getStartNode(nodes, flow.startNodeId);
  if (!startNode) return;

  const conversation = await prisma.conversation.findFirst({
    where: { id: jobData.conversationId, organizationId: jobData.organizationId },
    include: { contact: true },
  });
  if (!conversation || conversation.botHandoffAt) return;

  const state: FlowState = {
    flowId: flow.id,
    flowName: flow.name,
    currentNodeId: startNode.id,
    waitingFor: null,
    variables: {},
    attempts: 0,
  };
  if (conversation.contact?.name) state.variables.name = conversation.contact.name;

  const payload: InboundFlowPayload = {
    organizationId: jobData.organizationId,
    conversationId: jobData.conversationId,
    contactId: jobData.contactId,
    messageId: '',
    contactPhone: jobData.contactPhone,
    phoneNumberId: jobData.phoneNumberId,
    encryptedToken: jobData.encryptedToken,
    content: '',
    isNewConversation: jobData.isNewConversation,
  };

  await incrementFlowStat(flow.id, 'starts');
  await withConversationLock(jobData.conversationId, () =>
    runFromNode(
      payload,
      flow.id,
      nodes,
      startNode.id,
      state,
      conversation.contact?.name,
      conversation.contact?.tags || []
    )
  );
}
