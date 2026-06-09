import type { FlowNode } from './types';

export interface FlowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateFlowGraph(
  nodes: FlowNode[],
  triggerType: string,
  triggerConfig: Record<string, unknown>,
  startNodeId?: string | null
): FlowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (nodes.length === 0) {
    errors.push('Flow must have at least one step');
    return { valid: false, errors, warnings };
  }

  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) errors.push(`Duplicate step id: ${node.id}`);
    ids.add(node.id);
  }

  const idSet = new Set(nodes.map((n) => n.id));
  const startId = startNodeId && idSet.has(startNodeId) ? startNodeId : nodes[0].id;

  if (triggerType === 'KEYWORD' && !String(triggerConfig.keyword || '').trim()) {
    errors.push('Keyword is required for keyword trigger');
  }
  if (triggerType === 'CONTACT_TAG' && !String(triggerConfig.tag || '').trim()) {
    errors.push('Tag is required for contact tag trigger');
  }
  if (triggerType === 'SEGMENT') {
    const tags = triggerConfig.tags as string[] | undefined;
    if (!tags?.length) errors.push('At least one tag is required for segment trigger');
  }

  for (const node of nodes) {
    const refs: string[] = [];
    if (node.next) refs.push(node.next);
    if (node.branches) refs.push(...Object.values(node.branches).filter(Boolean));

    for (const ref of refs) {
      if (ref && !idSet.has(ref)) {
        errors.push(`Step "${node.id}" references missing step "${ref}"`);
      }
    }

    if (node.type === 'condition') {
      if (!node.branches?.true) warnings.push(`Condition step "${node.id}" has no true branch`);
      if (!node.branches?.false) warnings.push(`Condition step "${node.id}" has no false branch`);
    }

    if (node.type === 'buttons') {
      const mode = node.buttonMode || 'reply';
      if (mode === 'url' && !node.ctaUrl) errors.push(`URL button step "${node.id}" needs a URL`);
      if (mode === 'call' && !node.ctaPhone) errors.push(`Call button step "${node.id}" needs a phone number`);
      if (mode === 'reply' && node.buttons?.length) {
        for (const btn of node.buttons) {
          if (!node.branches?.[btn.id] && !node.next) {
            warnings.push(`Button "${btn.title}" in step "${node.id}" has no branch target`);
          }
        }
      }
    }

    if (node.type === 'list') {
      if (!node.listSections?.length) errors.push(`List step "${node.id}" needs at least one section`);
      for (const section of node.listSections || []) {
        for (const row of section.rows) {
          if (!node.branches?.[row.id] && !node.next) {
            warnings.push(`List item "${row.title}" in step "${node.id}" has no branch target`);
          }
        }
      }
    }

    if (node.type === 'goto_flow' && !node.targetFlowId) {
      errors.push(`Go to flow step "${node.id}" needs a target flow`);
    }

    if (node.type === 'goto_step' && !node.targetNodeId) {
      errors.push(`Go to step "${node.id}" needs a target step`);
    }

    if (node.type === 'location' && (node.latitude == null || node.longitude == null)) {
      errors.push(`Location step "${node.id}" needs latitude and longitude`);
    }

    if (node.type === 'contact_card' && (!node.contactName || !node.contactPhone)) {
      errors.push(`Contact card step "${node.id}" needs name and phone`);
    }

    if (node.type === 'wa_flow' && (!node.waFlowId || !node.waFlowToken)) {
      errors.push(`WhatsApp Flow step "${node.id}" needs flow ID and token`);
    }

    if (node.type === 'condition' && node.conditionType === 'variable_equals' && !node.conditionVariable) {
      errors.push(`Condition step "${node.id}" needs a variable name`);
    }

    if (node.type === 'schedule' && !node.scheduleAt && !node.delaySeconds) {
      errors.push(`Schedule step "${node.id}" needs a time or delay`);
    }

    if (node.type === 'template' && !node.templateName) {
      errors.push(`Template step "${node.id}" needs a template name`);
    }
    if (node.type === 'media' && !node.mediaUrl) {
      errors.push(`Media step "${node.id}" needs a media URL`);
    }
    if (node.type === 'webhook' && !node.webhookUrl) {
      errors.push(`Webhook step "${node.id}" needs a webhook URL`);
    }
    if (node.type === 'delay' && (!node.delaySeconds || node.delaySeconds < 1)) {
      errors.push(`Delay step "${node.id}" needs delay of at least 1 second`);
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
  }

  for (const node of nodes) {
    if (!reachable.has(node.id)) {
      warnings.push(`Step "${node.id}" (${node.type}) is unreachable from start`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
