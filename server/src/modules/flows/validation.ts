import type { FlowNode } from './types';
import { describeUnsafeWebhookUrl } from '../../utils/safe-webhook-url';
import { isUnsafeKeywordRegex } from './trigger-match';

const WAIT_OR_STOP_NODE_TYPES = new Set([
  'buttons',
  'list',
  'question',
  'delay',
  'schedule',
  'wa_flow',
  'handoff',
  'end',
  'ai',
]);

export interface FlowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function outgoingRefs(node: FlowNode): string[] {
  const refs: string[] = [];
  if (node.next) refs.push(node.next);
  if (node.branches) refs.push(...Object.values(node.branches).filter(Boolean));
  if (node.targetNodeId) refs.push(node.targetNodeId);
  return refs;
}

function isValidE164Phone(value?: string): boolean {
  if (!value?.trim()) return false;
  const normalized = value.replace(/[^\d+]/g, '');
  return /^\+?\d{8,15}$/.test(normalized);
}

function detectFlowCycles(
  nodes: FlowNode[],
  startId: string
): { dangerous: string[]; looping: string[] } {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const dangerous: string[] = [];
  const looping: string[] = [];
  const seenCycleKeys = new Set<string>();

  function recordCycle(fromId: string) {
    const start = stack.lastIndexOf(fromId);
    const cycle = start >= 0 ? stack.slice(start) : [fromId];
    const key = [...cycle].sort().join('>');
    if (seenCycleKeys.has(key)) return;
    seenCycleKeys.add(key);
    const hasWait = cycle.some((id) => {
      const node = byId.get(id);
      return node ? WAIT_OR_STOP_NODE_TYPES.has(node.type) : false;
    });
    const label = cycle.join(' → ');
    if (hasWait) looping.push(label);
    else dangerous.push(label);
  }

  function dfs(id: string): void {
    if (visiting.has(id)) {
      recordCycle(id);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    stack.push(id);
    const node = byId.get(id);
    if (node) {
      for (const nextId of outgoingRefs(node)) {
        if (byId.has(nextId)) dfs(nextId);
      }
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }

  dfs(startId);
  return { dangerous, looping };
}

export interface FlowValidationOptions {
  /** When saving an existing flow, warn if a goto_flow targets this same flow id. */
  currentFlowId?: string;
}

export function validateFlowGraph(
  nodes: FlowNode[],
  triggerType: string,
  triggerConfig: Record<string, unknown>,
  startNodeId?: string | null,
  options?: FlowValidationOptions
): FlowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (nodes.length === 0) {
    errors.push('Flow must have at least one step');
    return { valid: false, errors, warnings };
  }
  if (nodes.length > 100) {
    errors.push('Flow cannot contain more than 100 steps');
  }

  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) errors.push(`Duplicate step id: ${node.id}`);
    ids.add(node.id);
  }

  const idSet = new Set(nodes.map((n) => n.id));
  if (startNodeId && !idSet.has(startNodeId)) {
    errors.push(`Start step "${startNodeId}" does not exist`);
  }
  const startId = startNodeId && idSet.has(startNodeId) ? startNodeId : nodes[0].id;

  if (triggerType === 'KEYWORD' && !String(triggerConfig.keyword || '').trim()) {
    errors.push('Keyword is required for keyword trigger');
  }
  if (triggerType === 'KEYWORD' && triggerConfig.regex && triggerConfig.exactMatch) {
    errors.push('Keyword cannot use both exact match and regex');
  }
  if (triggerType === 'KEYWORD' && triggerConfig.regex && isUnsafeKeywordRegex(String(triggerConfig.keyword || ''))) {
    errors.push('Keyword regex is too complex or invalid');
  }
  if (triggerType === 'CONTACT_TAG' && !String(triggerConfig.tag || '').trim()) {
    errors.push('Tag is required for contact tag trigger');
  }
  if (triggerType === 'SEGMENT') {
    const tags = triggerConfig.tags as string[] | undefined;
    if (!tags?.length) errors.push('At least one tag is required for segment trigger');
  }

  for (const node of nodes) {
    const refs = outgoingRefs(node);

    for (const ref of refs) {
      if (ref && !idSet.has(ref)) {
        errors.push(`Step "${node.id}" references missing step "${ref}"`);
      }
    }

    if (node.type === 'condition') {
      if (!node.branches?.true) warnings.push(`Condition step "${node.id}" has no true branch`);
      if (!node.branches?.false) warnings.push(`Condition step "${node.id}" has no false branch`);
      if (!node.conditionType) errors.push(`Condition step "${node.id}" needs a rule`);
      if (node.conditionType === 'has_tag' && !node.conditionTag?.trim()) {
        errors.push(`Condition step "${node.id}" needs a tag`);
      }
      if (node.conditionType === 'language' && !node.languageCode?.trim()) {
        errors.push(`Condition step "${node.id}" needs a language`);
      }
      if (
        (node.conditionType === 'variable_equals' || node.conditionType === 'variable_contains') &&
        (!node.conditionVariable?.trim() || node.conditionValue == null)
      ) {
        errors.push(`Condition step "${node.id}" needs a variable and value`);
      }
    }

    if (node.type === 'buttons') {
      const mode = node.buttonMode || 'reply';
      if (!node.text?.trim()) errors.push(`Button step "${node.id}" needs message text`);
      if (mode === 'url' && !node.ctaUrl) errors.push(`URL button step "${node.id}" needs a URL`);
      if (mode === 'call' && !isValidE164Phone(node.ctaPhone)) {
        errors.push(`Call button step "${node.id}" needs a valid phone number`);
      }
      if (mode === 'reply' && node.buttons?.length) {
        const buttonIds = new Set<string>();
        for (const btn of node.buttons) {
          if (!btn.id?.trim() || buttonIds.has(btn.id.trim())) {
            errors.push(`Buttons in step "${node.id}" must have unique IDs`);
          }
          buttonIds.add(btn.id.trim());
          if (!btn.title?.trim()) {
            errors.push(`Button in step "${node.id}" needs a label`);
          }
          if (!node.branches?.[btn.id]?.trim()) {
            errors.push(`Button "${btn.title || btn.id}" in step "${node.id}" has no branch target`);
          }
        }
      }
      if (mode === 'reply' && !node.buttons?.length) {
        errors.push(`Reply button step "${node.id}" needs at least one button`);
      }
      if (mode === 'url' && node.ctaUrl) {
        try {
          if (new URL(node.ctaUrl).protocol !== 'https:') {
            errors.push(`URL button step "${node.id}" must use HTTPS`);
          }
        } catch {
          errors.push(`URL button step "${node.id}" has an invalid URL`);
        }
      }
    }

    if (node.type === 'list') {
      if (!node.text?.trim()) errors.push(`List step "${node.id}" needs message text`);
      if (!node.listSections?.length) errors.push(`List step "${node.id}" needs at least one section`);
      const totalRows = (node.listSections || []).reduce((sum, section) => sum + section.rows.length, 0);
      if (totalRows === 0) {
        errors.push(`List step "${node.id}" needs at least one row`);
      }
      if (totalRows > 10) {
        errors.push(`List step "${node.id}" has ${totalRows} rows; WhatsApp allows at most 10`);
      }
      const rowIds = new Set<string>();
      for (const section of node.listSections || []) {
        for (const row of section.rows) {
          if (!row.id?.trim() || rowIds.has(row.id.trim())) {
            errors.push(`List rows in step "${node.id}" must have unique IDs`);
          }
          rowIds.add(row.id.trim());
          if (!row.title?.trim()) {
            errors.push(`List row in step "${node.id}" needs a label`);
          }
          if (!node.branches?.[row.id] && !node.next) {
            errors.push(`List item "${row.title}" in step "${node.id}" has no branch target`);
          }
        }
      }
    }

    if (node.type === 'goto_flow' && !node.targetFlowId) {
      errors.push(`Go to flow step "${node.id}" needs a target flow`);
    }
    if (
      node.type === 'goto_flow' &&
      node.targetFlowId &&
      options?.currentFlowId &&
      node.targetFlowId === options.currentFlowId
    ) {
      warnings.push(
        `Go to flow step "${node.id}" jumps back into this same flow — avoid cycles that never end`,
      );
    }

    if (node.type === 'goto_step' && !node.targetNodeId) {
      errors.push(`Go to step "${node.id}" needs a target step`);
    }

    if (node.type === 'location' && (node.latitude == null || node.longitude == null)) {
      errors.push(`Location step "${node.id}" needs latitude and longitude`);
    }
    if (
      node.type === 'location' &&
      (node.latitude != null || node.longitude != null) &&
      (node.latitude == null ||
        node.longitude == null ||
        node.latitude < -90 ||
        node.latitude > 90 ||
        node.longitude < -180 ||
        node.longitude > 180)
    ) {
      errors.push(`Location step "${node.id}" has invalid coordinates`);
    }

    if (node.type === 'contact_card' && (!node.contactName?.trim() || !isValidE164Phone(node.contactPhone))) {
      errors.push(`Contact card step "${node.id}" needs a name and valid phone number`);
    }
    if (node.type === 'question' && node.field === 'custom' && !node.customField?.trim()) {
      errors.push(`Question step "${node.id}" needs a custom field name`);
    }

    if (node.type === 'wa_flow' && !node.waFlowId?.trim()) {
      errors.push(`In-chat form step "${node.id}" needs a form selected`);
    }

    if (node.type === 'schedule' && !node.scheduleAt && !node.delaySeconds) {
      errors.push(`Schedule step "${node.id}" needs a time or delay`);
    }
    if (node.type === 'schedule' && node.scheduleAt) {
      const scheduleTime = new Date(node.scheduleAt).getTime();
      if (Number.isNaN(scheduleTime)) {
        errors.push(`Schedule step "${node.id}" has an invalid date and time`);
      } else if (scheduleTime <= Date.now()) {
        errors.push(`Schedule step "${node.id}" must be in the future`);
      } else if (scheduleTime - Date.now() > 7 * 86400000) {
        errors.push(`Schedule step "${node.id}" cannot be more than 7 days ahead`);
      }
    }

    if (node.type === 'template' && !node.templateName) {
      errors.push(`Template step "${node.id}" needs a template name`);
    }
    if (node.type === 'media' && !node.mediaUrl) {
      errors.push(`Media step "${node.id}" needs a media URL`);
    }
    if (node.type === 'media' && node.mediaUrl) {
      try {
        const url = new URL(node.mediaUrl);
        if (url.protocol !== 'https:') {
          errors.push(`Media step "${node.id}" must use an HTTPS URL`);
        }
      } catch {
        errors.push(`Media step "${node.id}" has an invalid media URL`);
      }
    }
    if (node.type === 'webhook' && !node.webhookUrl) {
      errors.push(`Webhook step "${node.id}" needs a webhook URL`);
    }
    if (node.type === 'webhook' && node.webhookUrl) {
      const unsafe = describeUnsafeWebhookUrl(node.webhookUrl);
      if (unsafe) errors.push(`Webhook step "${node.id}": ${unsafe}`);
    }
    if (node.type === 'delay' && (!node.delaySeconds || node.delaySeconds < 1)) {
      errors.push(`Delay step "${node.id}" needs delay of at least 1 second`);
    }
    if (node.type === 'delay' && node.delaySeconds && node.delaySeconds > 86400) {
      errors.push(`Delay step "${node.id}" cannot exceed 24 hours`);
    }
    if (node.type === 'schedule' && node.delaySeconds && node.delaySeconds > 604800) {
      errors.push(`Schedule step "${node.id}" cannot exceed 7 days`);
    }
  }

  const reachable = new Set<string>();
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = nodes.find((n) => n.id === id);
    if (!node) continue;
    if (node.next) queue.push(node.next);
    if (node.branches) queue.push(...Object.values(node.branches).filter(Boolean));
    if (node.targetNodeId) queue.push(node.targetNodeId);
  }

  for (const node of nodes) {
    if (!reachable.has(node.id)) {
      warnings.push(`Step "${node.id}" (${node.type}) is unreachable from start`);
    }
  }

  const cycles = detectFlowCycles(nodes, startId);
  for (const cycle of cycles.dangerous) {
    errors.push(`Loop has no wait step and would spam messages: ${cycle}`);
  }
  for (const cycle of cycles.looping) {
    warnings.push(`Flow contains a loop (${cycle}). Runtime still stops after 50 steps.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}
