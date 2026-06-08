import { getOrgBusinessHours, isWithinBusinessHours } from '../settings/business-hours';
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
  if (config.exactMatch) return lower === keyword;
  return lower.includes(keyword);
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
    default:
      reason = 'Unknown trigger';
  }

  if (!triggered || !input.nodes.length) {
    return { triggered, reason, steps: [] };
  }

  const idSet = new Set(input.nodes.map((n) => n.id));
  const startId =
    input.startNodeId && idSet.has(input.startNodeId) ? input.startNodeId : input.nodes[0].id;

  const steps: SimulateStep[] = [];
  let currentId: string | null = startId;
  let iterations = 0;

  while (currentId && iterations < 20) {
    iterations++;
    const node = input.nodes.find((n) => n.id === currentId);
    if (!node) break;

    if (node.type === 'condition') {
      let branchKey = 'false';
      if (node.conditionType === 'business_hours') {
        branchKey = withinHours ? 'true' : 'false';
      } else if (node.conditionType === 'has_tag' && node.conditionTag) {
        branchKey = input.contactTags?.includes(node.conditionTag) ? 'true' : 'false';
      } else if (node.conditionType === 'language' && node.languageCode) {
        branchKey = 'false';
      }
      steps.push({ nodeId: node.id, type: node.type, action: `Branch: ${branchKey}`, branch: branchKey });
      currentId = node.branches?.[branchKey] || node.next || null;
      continue;
    }

    if (node.type === 'buttons') {
      steps.push({ nodeId: node.id, type: node.type, action: node.text || 'Show buttons' });
      const firstBtn = node.buttons?.[0];
      currentId = firstBtn ? node.branches?.[firstBtn.id] || node.next || null : node.next || null;
      continue;
    }

    if (node.type === 'question') {
      steps.push({ nodeId: node.id, type: node.type, action: node.prompt || 'Ask question' });
      steps.push({ nodeId: node.id, type: 'user', action: '[Customer reply]' });
      currentId = node.next || null;
      continue;
    }

    if (node.type === 'ab_split') {
      const branchKey = Math.random() < 0.5 ? 'a' : 'b';
      steps.push({ nodeId: node.id, type: node.type, action: `A/B branch: ${branchKey}`, branch: branchKey });
      currentId = node.branches?.[branchKey] || node.next || null;
      continue;
    }

    steps.push({
      nodeId: node.id,
      type: node.type,
      action: node.text || node.prompt || node.tag || node.type,
    });

    if (['handoff', 'end', 'ai'].includes(node.type)) break;
    currentId = node.next || null;
  }

  return { triggered, reason, steps };
}
