import { getOrgBusinessHours, isWithinBusinessHours } from '../settings/business-hours';
import { linkFlowNodes } from './link-nodes';
import { matchInteractiveTextIntent } from './branch-resolve';
import { detectMessageLanguage } from './language';
import { keywordMatches } from './trigger-match';
import type { FlowNode, FlowTriggerConfig } from './types';

export interface SimulateInput {
  organizationId: string;
  triggerType: string;
  triggerConfig: FlowTriggerConfig;
  nodes: FlowNode[];
  startNodeId?: string | null;
  message: string;
  isNewConversation: boolean;
  contactTags?: string[];
}

export interface SimulateStep {
  nodeId: string;
  type: string;
  action: string;
  branch?: string;
}

function nodeAction(node: FlowNode): string {
  switch (node.type) {
    case 'message':
    case 'handoff':
    case 'ai':
    case 'end':
    case 'assign':
      return node.text || node.type;
    case 'buttons':
      return node.text || 'Show buttons';
    case 'list':
      return node.text || 'Show list menu';
    case 'question':
      return node.prompt || 'Ask question';
    case 'tag':
      return `Add tag: ${node.tag || '—'}`;
    case 'remove_tag':
      return `Remove tag: ${node.tag || '—'}`;
    case 'set_variable':
      return `Set ${node.variableName || 'variable'}`;
    case 'template':
      return node.text || `Template: ${node.templateName || '—'}`;
    case 'media':
      return node.mediaCaption || node.text || `Send ${node.mediaType || 'media'}`;
    case 'delay':
      return `Wait ${node.delaySeconds || 30}s`;
    case 'schedule':
      return node.scheduleAt ? `Schedule at ${node.scheduleAt}` : `Wait ${node.delaySeconds || 3600}s`;
    case 'webhook':
      return `Webhook: ${node.webhookUrl || '—'}`;
    case 'goto_step':
      return `Jump to step`;
    case 'goto_flow':
      return `Start another flow`;
    case 'location':
      return node.text || node.locationName || 'Send location';
    case 'contact_card':
      return node.text || `Share contact: ${node.contactName || '—'}`;
    case 'wa_flow':
      return node.text || 'Open Meta form';
    case 'request_callback':
      return node.text || 'Request callback';
    default:
      return node.text || node.prompt || node.tag || node.type;
  }
}

function resolveConditionBranch(
  node: FlowNode,
  withinHours: boolean,
  contactTags: string[] | undefined,
  variables: Record<string, string>
): string {
  if (node.conditionType === 'business_hours') {
    return withinHours ? 'true' : 'false';
  }
  if (node.conditionType === 'has_tag' && node.conditionTag) {
    return contactTags?.includes(node.conditionTag) ? 'true' : 'false';
  }
  if (node.conditionType === 'language' && node.languageCode) {
    const lang = variables.language || variables.lang || '';
    return lang.toLowerCase() === node.languageCode.toLowerCase() ? 'true' : 'false';
  }
  if (node.conditionType === 'variable_equals' && node.conditionVariable) {
    const actual = variables[node.conditionVariable] || '';
    return actual === (node.conditionValue || '') ? 'true' : 'false';
  }
  if (node.conditionType === 'variable_contains' && node.conditionVariable) {
    const actual = (variables[node.conditionVariable] || '').toLowerCase();
    const expected = (node.conditionValue || '').toLowerCase();
    return expected && actual.includes(expected) ? 'true' : 'false';
  }
  if (node.conditionType === 'webhook_ok') {
    return variables.webhook_ok === 'true' ? 'true' : 'false';
  }
  return 'false';
}

function nextFromNode(node: FlowNode, branchKey?: string): string | null {
  if (branchKey && node.branches?.[branchKey]) return node.branches[branchKey];
  return node.next || null;
}

export async function simulateFlow(input: SimulateInput): Promise<{
  triggered: boolean;
  reason: string;
  steps: SimulateStep[];
}> {
  const hours = await getOrgBusinessHours(input.organizationId);
  const withinHours = isWithinBusinessHours(hours);
  const hasContent = Boolean(input.message?.trim());
  const config = input.triggerConfig || {};

  let triggered = false;
  let reason = '';

  switch (input.triggerType) {
    case 'WELCOME':
      triggered = input.isNewConversation;
      reason = triggered ? 'New conversation' : 'Not a new conversation';
      break;
    case 'KEYWORD':
      triggered = hasContent && keywordMatches(input.message, config);
      reason = triggered ? `Keyword matched` : 'Keyword did not match';
      break;
    case 'BUSINESS_HOURS':
      triggered = withinHours && hasContent;
      reason = triggered ? 'Within business hours' : 'Outside business hours or empty message';
      break;
    case 'OFF_HOURS':
      triggered = !withinHours && hasContent;
      reason = triggered ? 'Outside business hours' : 'Within business hours or empty message';
      break;
    case 'ANY_MESSAGE':
      triggered = hasContent && !input.isNewConversation;
      reason = triggered ? 'Returning customer message' : 'New conversation or empty';
      break;
    case 'CONTACT_TAG':
      triggered = Boolean(config.tag && input.contactTags?.includes(config.tag));
      reason = triggered ? `Contact has tag "${config.tag}"` : 'Contact missing required tag';
      break;
    case 'SEGMENT':
      triggered = Boolean(config.tags?.some((t) => input.contactTags?.includes(t)));
      reason = triggered ? 'Contact in segment' : 'Contact not in segment';
      break;
    case 'MISSED_CALL':
      triggered = true;
      reason = 'Triggered by missed call event';
      break;
    case 'CAMPAIGN_REPLY':
      triggered = hasContent;
      reason = hasContent
        ? 'Preview only: live CAMPAIGN_REPLY also needs a recent campaign send on this chat'
        : 'No campaign context';
      break;
    case 'CALL_COMPLETED':
      triggered = true;
      reason = 'Triggered by completed call event';
      break;
    default:
      reason = 'Unknown trigger';
  }

  const linkedNodes = linkFlowNodes(input.nodes);
  if (!triggered || !linkedNodes.length) {
    return { triggered, reason, steps: [] };
  }

  const idSet = new Set(linkedNodes.map((n) => n.id));
  const startId =
    input.startNodeId && idSet.has(input.startNodeId) ? input.startNodeId : linkedNodes[0].id;

  const steps: SimulateStep[] = [];
  const variables: Record<string, string> = {};
  if (input.message?.trim()) {
    variables.language = detectMessageLanguage(input.message);
  }
  let currentId: string | null = startId;
  let iterations = 0;

  while (currentId && iterations < 30) {
    iterations++;
    const node = linkedNodes.find((n) => n.id === currentId);
    if (!node) break;

    if (node.type === 'condition') {
      const branchKey = resolveConditionBranch(node, withinHours, input.contactTags, variables);
      steps.push({ nodeId: node.id, type: node.type, action: `Branch: ${branchKey}`, branch: branchKey });
      currentId = nextFromNode(node, branchKey);
      continue;
    }

    if (node.type === 'buttons') {
      const mode = node.buttonMode || 'reply';
      steps.push({ nodeId: node.id, type: node.type, action: nodeAction(node) });
      if (mode === 'url' || mode === 'call') {
        currentId = node.next || null;
        continue;
      }
      const intentId = matchInteractiveTextIntent(node, input.message);
      const chosen =
        (intentId ? node.buttons?.find((b) => b.id === intentId) : undefined) || node.buttons?.[0];
      if (chosen) {
        steps.push({
          nodeId: node.id,
          type: 'user',
          action: intentId ? `[Taps: ${chosen.title}]` : `[Preview taps first: ${chosen.title}]`,
        });
        currentId = nextFromNode(node, chosen.id);
      } else {
        currentId = node.next || null;
      }
      continue;
    }

    if (node.type === 'list') {
      steps.push({ nodeId: node.id, type: node.type, action: nodeAction(node) });
      const firstRow = node.listSections?.flatMap((s) => s.rows)[0];
      if (firstRow) {
        steps.push({ nodeId: node.id, type: 'user', action: `[Selects: ${firstRow.title}]` });
        currentId = nextFromNode(node, firstRow.id);
      } else {
        currentId = node.next || null;
      }
      continue;
    }

    if (node.type === 'question') {
      steps.push({ nodeId: node.id, type: node.type, action: nodeAction(node) });
      steps.push({ nodeId: node.id, type: 'user', action: '[Customer reply]' });
      const fieldKey = node.field === 'custom' ? node.customField || 'answer' : node.field || 'name';
      variables[fieldKey] = 'Sample answer';
      currentId = node.next || null;
      continue;
    }

    if (node.type === 'ab_split') {
      const branchKey = Math.random() < (Math.min(Math.max(node.splitRatio ?? 50, 1), 99) / 100) ? 'a' : 'b';
      steps.push({ nodeId: node.id, type: node.type, action: `A/B branch: ${branchKey}`, branch: branchKey });
      currentId = nextFromNode(node, branchKey);
      continue;
    }

    if (node.type === 'language') {
      const branchKey =
        node.languageCode && variables.language === node.languageCode ? 'match' : 'default';
      steps.push({ nodeId: node.id, type: node.type, action: `Language branch: ${branchKey}`, branch: branchKey });
      currentId = nextFromNode(node, branchKey);
      continue;
    }

    if (node.type === 'set_variable' && node.variableName) {
      variables[node.variableName] = node.variableValue || '';
    }

    if (node.type === 'goto_step') {
      steps.push({ nodeId: node.id, type: node.type, action: nodeAction(node) });
      currentId = node.targetNodeId || node.next || null;
      continue;
    }

    if (node.type === 'goto_flow') {
      steps.push({ nodeId: node.id, type: node.type, action: nodeAction(node) });
      break;
    }

    if (node.type === 'wa_flow') {
      steps.push({ nodeId: node.id, type: node.type, action: nodeAction(node) });
      steps.push({ nodeId: node.id, type: 'user', action: '[Form submitted]' });
      currentId = node.next || null;
      continue;
    }

    if (node.type === 'delay' || node.type === 'schedule') {
      steps.push({ nodeId: node.id, type: node.type, action: nodeAction(node) });
      currentId = node.next || null;
      continue;
    }

    steps.push({
      nodeId: node.id,
      type: node.type,
      action: nodeAction(node),
    });

    if (['handoff', 'end', 'ai'].includes(node.type)) break;
    currentId = node.next || null;
  }

  return { triggered, reason, steps };
}
