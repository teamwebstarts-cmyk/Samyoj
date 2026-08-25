import type { FlowButton, FlowNode, FlowNodeType } from '../../types';
import { nodeMeta } from './flowMeta';

function isValidE164Phone(value?: string): boolean {
  if (!value?.trim()) return false;
  return /^\+?\d{8,15}$/.test(value.replace(/[^\d+]/g, ''));
}

/** Align button ids with branch keys before save (fixes option 3 routing after edits). */
export function syncButtonNode(node: FlowNode): FlowNode {
  if (node.type !== 'buttons') return node;

  const oldButtons = node.buttons || [];
  const branches = { ...(node.branches || {}) };
  const seen = new Set<string>();

  const buttons = oldButtons.slice(0, 3).map((btn, idx) => {
    let id = btn.id?.trim() || `${node.id}-btn-${idx}`;
    if (seen.has(id)) id = `${node.id}-btn-${idx}`;
    seen.add(id);
    return {
      id,
      title: (btn.title?.trim() || `Option ${idx + 1}`).slice(0, 20),
    };
  });

  const syncedBranches: Record<string, string> = {};
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    const oldBtn = oldButtons[i];
    const target =
      branches[btn.id] ||
      (oldBtn ? branches[oldBtn.id] : undefined) ||
      Object.values(branches)[i];
    if (target?.trim()) syncedBranches[btn.id] = target.trim();
  }

  return { ...node, buttons, branches: syncedBranches };
}

export function prepareNodesForSave(nodes: FlowNode[]): FlowNode[] {
  const normalized = nodes.map((node) => {
    const withCondition =
      node.type === 'condition' && !node.conditionType
        ? { ...node, conditionType: 'business_hours' as const }
        : node;
    return syncButtonNode(withCondition);
  });
  return linkNodes(normalized);
}

export function linkNodes(nodes: FlowNode[]): FlowNode[] {
  if (!nodes.length) return nodes;

  const branchTargets = new Set<string>();
  for (const node of nodes) {
    if (node.next) branchTargets.add(node.next);
    if (node.targetNodeId) branchTargets.add(node.targetNodeId);
    for (const target of Object.values(node.branches || {})) {
      if (target?.trim()) branchTargets.add(target.trim());
    }
  }

  return nodes.map((node, index) => {
    const fallbackNext = index < nodes.length - 1 ? nodes[index + 1].id : undefined;
    const linearFallback = branchTargets.has(node.id) ? undefined : fallbackNext;

    if (node.type === 'buttons' || node.type === 'list') {
      return {
        ...node,
        branches: { ...(node.branches || {}) },
        next: node.next || linearFallback,
      };
    }

    if (node.type === 'condition' || node.type === 'ab_split') {
      return { ...node, branches: { ...(node.branches || {}) } };
    }

    if (node.type === 'language') {
      const branches = { ...(node.branches || {}) };
      if (!branches.default && linearFallback) branches.default = linearFallback;
      return { ...node, branches };
    }

    return { ...node, next: node.next || linearFallback };
  });
}

export function getNodeSummary(node: FlowNode): string {
  switch (node.type) {
    case 'message':
    case 'handoff':
    case 'ai':
    case 'end':
    case 'assign':
      return node.text || '—';
    case 'buttons':
      if (node.buttonMode === 'url') return node.ctaUrl ? `URL: ${node.ctaLabel || node.ctaUrl}` : 'URL button';
      if (node.buttonMode === 'call') return node.ctaPhone ? `Call: ${node.ctaLabel || node.ctaPhone}` : 'Call button';
      return node.text || `${node.buttons?.length || 0} buttons`;
    case 'list':
      return node.text || `${node.listSections?.flatMap((s) => s.rows).length || 0} menu items`;
    case 'question':
      return node.prompt || 'Ask question';
    case 'tag':
      return `Tag: ${node.tag || '—'}`;
    case 'remove_tag':
      return `Remove tag: ${node.tag || '—'}`;
    case 'set_variable':
      return `Save ${node.variableName || 'answer'}: ${node.variableValue || '—'}`;
    case 'goto_flow':
      return node.targetFlowId ? 'Switch to another auto-reply' : 'Switch auto-reply';
    case 'request_callback':
      return node.text || 'Request callback';
    case 'goto_step':
      return node.targetNodeId ? 'Loop to step' : 'Go to step';
    case 'location':
      return node.locationName || `${node.latitude}, ${node.longitude}`;
    case 'contact_card':
      return node.contactName || 'Contact card';
    case 'wa_flow':
      return node.waFlowId ? `Form: ${node.waFlowCta || node.waFlowId}` : 'WhatsApp form';
    case 'schedule':
      return node.scheduleAt ? `At ${node.scheduleAt}` : `Wait ${node.delaySeconds || 0}s`;
    case 'condition':
      if (node.conditionType === 'has_tag') return `If tag: ${node.conditionTag}`;
      if (node.conditionType === 'language') return `If language: ${node.languageCode}`;
      return 'If business hours';
    case 'template':
      return node.templateName ? `Template: ${node.templateName}` : 'Template message';
    case 'delay':
      return `Wait ${node.delaySeconds || 0}s`;
    case 'media':
      return node.mediaCaption || node.mediaUrl || 'Media message';
    case 'webhook':
      return node.webhookUrl || 'Connect to app';
    case 'ab_split':
      return 'Compare two paths';
    case 'language':
      return `Language: ${node.languageCode || 'en'}`;
    default:
      return '—';
  }
}

export function getBranchLabels(
  node: FlowNode,
  allNodes: FlowNode[]
): Array<{ key: string; label: string; targetId?: string; targetLabel: string }> {
  if (!node.branches) return [];

  return Object.entries(node.branches).map(([key, targetId]) => {
    const target = allNodes.find((n) => n.id === targetId);
    const targetLabel = target ? `${allNodes.indexOf(target) + 1}. ${target.type}` : 'Next';
    return { key, label: key, targetId, targetLabel };
  });
}

export function validateFlow(
  name: string,
  triggerType: string,
  triggerConfig: Record<string, unknown>,
  keyword: string,
  nodes: FlowNode[]
): string[] {
  const errors: string[] = [];
  if (!name.trim()) errors.push('Flow name is required');
  if (triggerType === 'KEYWORD' && !keyword.trim()) errors.push('Enter the word customers should text');
  if (triggerType === 'CONTACT_TAG' && !String(triggerConfig.tag || '').trim()) {
    errors.push('Enter the tag the contact must have');
  }
  if (triggerType === 'SEGMENT') {
    const tags = triggerConfig.tags as string[] | undefined;
    if (!tags?.length) errors.push('Add at least one contact tag');
  }
  if (nodes.length === 0) errors.push('Add at least one step');
  if (nodes.length > 100) errors.push('Keep the flow under 100 steps');

  for (const node of nodes) {
    const stepLabel = nodeMeta[node.type]?.label || node.type;
    if (['message', 'handoff', 'ai', 'end', 'assign'].includes(node.type) && !node.text?.trim()) {
      errors.push(`${stepLabel} needs a message`);
    }
    if (node.type === 'buttons') {
      if (!node.text?.trim()) errors.push('Quick Buttons needs a message');
      const mode = node.buttonMode || 'reply';
      if (mode === 'reply' && !node.buttons?.length) errors.push('Add at least one reply button');
      if (mode === 'reply' && node.buttons?.length) {
        const buttonIds = new Set<string>();
        for (let i = 0; i < node.buttons.length; i++) {
          const btn: FlowButton = node.buttons[i];
          const buttonId = btn.id?.trim() || '';
          if (!buttonId || buttonIds.has(buttonId)) errors.push('Reply buttons need unique IDs');
          buttonIds.add(buttonId);
          if (!btn.title?.trim()) errors.push(`Button ${i + 1} needs a label`);
          if (!node.branches?.[buttonId]) {
            errors.push(`Button "${btn.title || i + 1}" needs a connected next step`);
          }
        }
      }
      if (mode === 'url' && !node.ctaUrl?.trim()) errors.push('Add a website link for the URL button');
      if (mode === 'call' && !node.ctaPhone?.trim()) errors.push('Add a phone number for the call button');
      if (mode === 'url' && node.ctaUrl?.trim()) {
        try {
          if (new URL(node.ctaUrl).protocol !== 'https:') errors.push('Website links must use HTTPS');
        } catch {
          errors.push('Enter a valid website link');
        }
      }
    }
    if (node.type === 'list') {
      if (!node.text?.trim()) errors.push('List Menu needs a message');
      const rows = node.listSections?.flatMap((s) => s.rows) || [];
      if (!rows.length) errors.push('List Menu needs at least one option');
      const rowIds = new Set<string>();
      for (const row of rows) {
        if (!row.id?.trim() || rowIds.has(row.id.trim())) errors.push('List options need unique IDs');
        rowIds.add(row.id.trim());
        if (!row.title?.trim()) errors.push('List options need a label');
        if (!node.branches?.[row.id?.trim() || ''] && !node.next) {
          errors.push(`List option "${row.title || 'item'}" needs a connected next step`);
        }
      }
    }
    if (node.type === 'condition') {
      const conditionType = node.conditionType || 'business_hours';
      if (conditionType === 'has_tag' && !node.conditionTag?.trim()) errors.push('Enter the tag to check');
      if (conditionType === 'language' && !node.languageCode?.trim()) errors.push('Enter the language to check');
      if (
        (conditionType === 'variable_equals' || conditionType === 'variable_contains') &&
        (!node.conditionVariable?.trim() || node.conditionValue == null)
      ) {
        errors.push('Enter both a saved answer name and value');
      }
    }
    if (node.type === 'question' && !node.prompt?.trim()) errors.push('Ask Question needs a question');
    if (node.type === 'tag' && !node.tag?.trim()) errors.push('Add Tag needs a tag name');
    if (node.type === 'template' && !node.templateName?.trim()) errors.push('Template Message needs a template');
    if (node.type === 'media' && !node.mediaUrl?.trim()) errors.push('Send Media needs a file link');
    if (node.type === 'wa_flow' && !node.waFlowId?.trim()) errors.push('WhatsApp Form needs a form selected');
    if (node.type === 'location') {
      if (node.latitude == null || node.longitude == null) {
        errors.push('Send Location needs latitude and longitude');
      } else if (
        node.latitude < -90 ||
        node.latitude > 90 ||
        node.longitude < -180 ||
        node.longitude > 180
      ) {
        errors.push('Enter valid map coordinates');
      }
    }
    if (
      node.type === 'contact_card' &&
      (!node.contactName?.trim() || !isValidE164Phone(node.contactPhone))
    ) {
      errors.push('Contact Card needs a name and valid phone number');
    }
    if (node.type === 'buttons' && node.buttonMode === 'call' && !isValidE164Phone(node.ctaPhone)) {
      errors.push('Enter a valid phone number for the call button');
    }
    if (node.type === 'delay' && (!node.delaySeconds || node.delaySeconds < 1)) {
      errors.push('Wait step needs at least 1 second');
    }
    if (node.type === 'delay' && node.delaySeconds && node.delaySeconds > 86400) {
      errors.push('Wait step cannot exceed 24 hours');
    }
    if (node.type === 'schedule') {
      if (!node.scheduleAt && (!node.delaySeconds || node.delaySeconds < 1)) {
        errors.push('Schedule step needs a date or a delay');
      }
      if (node.scheduleAt && Number.isNaN(new Date(node.scheduleAt).getTime())) {
        errors.push('Enter a valid schedule date and time');
      }
      if (
        node.scheduleAt &&
        !Number.isNaN(new Date(node.scheduleAt).getTime()) &&
        new Date(node.scheduleAt).getTime() <= Date.now()
      ) {
        errors.push('Schedule step must be in the future');
      } else if (
        node.scheduleAt &&
        !Number.isNaN(new Date(node.scheduleAt).getTime()) &&
        new Date(node.scheduleAt).getTime() - Date.now() > 7 * 86400000
      ) {
        errors.push('Schedule step cannot be more than 7 days ahead');
      }
      if (node.delaySeconds && node.delaySeconds > 604800) {
        errors.push('Schedule step cannot exceed 7 days');
      }
    }
  }

  return errors;
}

export type FlowPreviewMessage =
  | {
      id: string;
      kind: 'outbound';
      text: string;
      time: string;
      status?: 'sent' | 'delivered' | 'read';
    }
  | { id: string; kind: 'inbound'; text: string; time: string }
  | {
      id: string;
      kind: 'buttons';
      text: string;
      buttons: Array<{ id: string; title: string }>;
      time: string;
    }
  | { id: string; kind: 'button_reply'; text: string; time: string }
  | { id: string; kind: 'notice'; text: string };

function previewTime(index: number): string {
  const hour = 10 + Math.floor(index / 12);
  const minute = (index * 3) % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

type PreviewPush = (message: Record<string, unknown> & { id?: string }) => void;

function processNodeForPreview(
  node: FlowNode,
  push: PreviewPush,
  seq: { value: number },
  options: { branchChoice?: string; markAsRead?: boolean },
): { jumpToNodeId?: string | null; stop?: boolean } {
  const time = previewTime(seq.value);

  if (node.type === 'buttons') {
    const body = node.text?.trim() || 'Please choose an option:';
    const mode = node.buttonMode || 'reply';

    if (mode === 'url') {
      push({
        kind: 'buttons',
        text: body,
        buttons: [{ id: 'url', title: `🔗 ${node.ctaLabel?.trim() || 'Visit website'}` }],
        time,
      });
      return { jumpToNodeId: node.next ?? null };
    }

    if (mode === 'call') {
      push({
        kind: 'buttons',
        text: body,
        buttons: [{ id: 'call', title: `📞 ${node.ctaLabel?.trim() || 'Call us'}` }],
        time,
      });
      return { jumpToNodeId: node.next ?? null };
    }

    push({
      kind: 'buttons',
      text: body,
      buttons: (node.buttons || []).map((btn) => ({ id: btn.id, title: btn.title })),
      time,
    });

    const btn = node.buttons?.find((b) => b.id === options.branchChoice) || node.buttons?.[0];
    if (btn) {
      push({ kind: 'button_reply', text: btn.title, time: previewTime(seq.value) });
      return { jumpToNodeId: node.branches?.[btn.id] ?? node.next ?? null };
    }
    return { jumpToNodeId: node.next ?? null };
  }

  if (node.type === 'list') {
    const body = node.text?.trim() || 'Please select from the menu:';
    const menuLabel = node.listButtonLabel?.trim() || 'View options';
    push({
      kind: 'buttons',
      text: body,
      buttons: [{ id: 'list-menu', title: `☰ ${menuLabel}` }],
      time,
    });
    const firstRow = node.listSections?.flatMap((s) => s.rows)[0];
    if (firstRow) {
      push({ kind: 'button_reply', text: firstRow.title, time: previewTime(seq.value) });
      return { jumpToNodeId: node.branches?.[firstRow.id] ?? node.next ?? null };
    }
    return { jumpToNodeId: node.next ?? null };
  }

  if (node.type === 'question') {
    const prompt = node.prompt?.trim() || node.text?.trim();
    if (prompt) push({ kind: 'outbound', text: prompt, time, status: 'read' });
    const samples: Record<string, string> = {
      name: 'Rahul Sharma',
      email: 'rahul@example.com',
      phone: '+91 98765 43210',
      custom: 'Customer answer',
    };
    push({
      kind: 'inbound',
      text: samples[node.field || 'name'] || 'Customer answer',
      time: previewTime(seq.value),
    });
    return { jumpToNodeId: node.next ?? null };
  }

  if (node.type === 'condition') {
    push({ kind: 'notice', text: 'Rule checked — showing yes path' });
    return { jumpToNodeId: node.branches?.true ?? node.next ?? null };
  }

  if (node.type === 'ab_split') {
    push({ kind: 'notice', text: 'Split test — showing path A' });
    return { jumpToNodeId: node.branches?.a ?? node.next ?? null };
  }

  if (node.type === 'tag') {
    push({ kind: 'notice', text: `Contact tagged: ${node.tag || 'lead'}` });
    return { jumpToNodeId: node.next ?? null };
  }

  if (node.type === 'assign') {
    const text = node.text?.trim() || 'Connecting you with our team...';
    push({ kind: 'outbound', text, time, status: 'delivered' });
    push({ kind: 'notice', text: 'Assigned to available agent' });
    return { jumpToNodeId: node.next ?? null };
  }

  if (node.type === 'handoff') {
    const text = node.text?.trim() || 'Let me connect you with our team.';
    push({ kind: 'outbound', text, time, status: 'delivered' });
    push({ kind: 'notice', text: 'Passed to your team' });
    return { stop: true };
  }

  if (node.type === 'delay') {
    push({ kind: 'notice', text: `Waiting ${node.delaySeconds || 30} seconds...` });
    return { jumpToNodeId: node.next ?? null };
  }

  if (node.type === 'webhook') {
    push({ kind: 'notice', text: 'Connected to your app' });
    return { jumpToNodeId: node.next ?? null };
  }

  if (node.type === 'template') {
    const text = node.text?.trim() || `Template: ${node.templateName || 'message'}`;
    push({ kind: 'outbound', text, time, status: 'delivered' });
    return { jumpToNodeId: node.next ?? null };
  }

  if (node.type === 'media') {
    const caption = node.mediaCaption?.trim();
    const label = caption || `${node.mediaType || 'Media'} attachment`;
    push({ kind: 'outbound', text: `📎 ${label}`, time, status: 'delivered' });
    return { jumpToNodeId: node.next ?? null };
  }

  if (node.type === 'ai') {
    const text = node.text?.trim() || 'Let me help with that...';
    push({ kind: 'outbound', text, time, status: 'read' });
    return { stop: true };
  }

  if (node.type === 'end') {
    const text = node.text?.trim() || 'Thank you! Have a great day.';
    push({ kind: 'outbound', text, time, status: 'read' });
    return { stop: true };
  }

  if (node.type === 'wa_flow') {
    const body = node.text?.trim() || 'Please fill out this form:';
    const cta = node.waFlowCta?.trim() || 'Open form';
    push({
      kind: 'buttons',
      text: body,
      buttons: [{ id: 'wa-form', title: `📝 ${cta}` }],
      time,
    });
    push({ kind: 'button_reply', text: 'Form submitted ✓', time: previewTime(seq.value) });
    return { jumpToNodeId: node.next ?? null };
  }

  const text = node.text?.trim() || getNodeSummary(node);
  if (text && text !== '—') {
    push({
      kind: 'outbound',
      text,
      time,
      status: options.markAsRead ? 'read' : 'delivered',
    });
  }
  return { jumpToNodeId: node.next ?? null };
}

export function buildFullFlowPreviewMessages(
  nodes: FlowNode[],
  startNodeId?: string,
): FlowPreviewMessage[] {
  if (!nodes.length) return [];

  const idSet = new Set(nodes.map((n) => n.id));
  const startId = startNodeId && idSet.has(startNodeId) ? startNodeId : nodes[0].id;

  const messages: FlowPreviewMessage[] = [];
  const seq = { value: 0 };
  const push: PreviewPush = (message) => {
    messages.push({ ...message, id: message.id ?? `preview-${seq.value++}` } as FlowPreviewMessage);
  };

  let currentId: string | null = startId;
  let iterations = 0;
  const visited = new Set<string>();

  while (currentId && iterations < 30) {
    iterations++;
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const node = nodes.find((n) => n.id === currentId);
    if (!node) break;

    const { jumpToNodeId, stop } = processNodeForPreview(node, push, seq, {});
    if (stop) break;
    currentId = jumpToNodeId !== undefined ? jumpToNodeId : null;
  }

  return messages;
}

export function buildFlowPreviewMessages(
  nodes: FlowNode[],
  selectedIndex: number,
  branchChoice?: string,
): FlowPreviewMessage[] {
  const messages: FlowPreviewMessage[] = [];
  let i = 0;
  let seq = 0;

  const push = (message: Record<string, unknown> & { id?: string }) => {
    messages.push({ ...message, id: message.id ?? `preview-${seq++}` } as FlowPreviewMessage);
  };

  while (i <= selectedIndex && i < nodes.length) {
    const node = nodes[i];
    const time = previewTime(seq);

    if (node.type === 'buttons') {
      const body = node.text?.trim() || 'Please choose an option:';
      const mode = node.buttonMode || 'reply';

      if (mode === 'url') {
        push({
          kind: 'buttons',
          text: body,
          buttons: [{ id: 'url', title: `🔗 ${node.ctaLabel?.trim() || 'Visit website'}` }],
          time,
        });
      } else if (mode === 'call') {
        push({
          kind: 'buttons',
          text: body,
          buttons: [{ id: 'call', title: `📞 ${node.ctaLabel?.trim() || 'Call us'}` }],
          time,
        });
      } else {
        push({
          kind: 'buttons',
          text: body,
          buttons: (node.buttons || []).map((btn) => ({ id: btn.id, title: btn.title })),
          time,
        });

        const btn = node.buttons?.find((b) => b.id === branchChoice) || node.buttons?.[0];
        if (btn) {
          push({ kind: 'button_reply', text: btn.title, time: previewTime(seq) });
          if (node.branches?.[btn.id]) {
            const nextIdx = nodes.findIndex((n) => n.id === node.branches![btn.id]);
            if (nextIdx > i) {
              i = nextIdx;
              continue;
            }
          }
        }
      }
    } else if (node.type === 'list') {
      const body = node.text?.trim() || 'Please select from the menu:';
      const menuLabel = node.listButtonLabel?.trim() || 'View options';
      push({
        kind: 'buttons',
        text: body,
        buttons: [{ id: 'list-menu', title: `☰ ${menuLabel}` }],
        time,
      });
      const firstRow = node.listSections?.flatMap((s) => s.rows)[0];
      if (firstRow) {
        push({ kind: 'button_reply', text: firstRow.title, time: previewTime(seq) });
        if (node.branches?.[firstRow.id]) {
          const nextIdx = nodes.findIndex((n) => n.id === node.branches![firstRow.id]);
          if (nextIdx > i) {
            i = nextIdx;
            continue;
          }
        }
      }
    } else if (node.type === 'question') {
      const prompt = node.prompt?.trim() || node.text?.trim();
      if (prompt) push({ kind: 'outbound', text: prompt, time, status: 'read' });
      const samples: Record<string, string> = {
        name: 'Rahul Sharma',
        email: 'rahul@example.com',
        phone: '+91 98765 43210',
        custom: 'Customer answer',
      };
      push({ kind: 'inbound', text: samples[node.field || 'name'] || 'Customer answer', time: previewTime(seq) });
    } else if (node.type === 'condition') {
      push({ kind: 'notice', text: 'Rule checked — showing yes path' });
      if (node.branches?.true) {
        const nextIdx = nodes.findIndex((n) => n.id === node.branches!.true);
        if (nextIdx > i) {
          i = nextIdx;
          continue;
        }
      }
    } else if (node.type === 'tag') {
      push({ kind: 'notice', text: `Contact tagged: ${node.tag || 'lead'}` });
    } else if (node.type === 'assign') {
      const text = node.text?.trim() || 'Connecting you with our team...';
      push({ kind: 'outbound', text, time, status: 'delivered' });
      push({ kind: 'notice', text: 'Assigned to available agent' });
    } else if (node.type === 'handoff') {
      const text = node.text?.trim() || 'Let me connect you with our team.';
      push({ kind: 'outbound', text, time, status: 'delivered' });
      push({ kind: 'notice', text: 'Passed to your team' });
    } else if (node.type === 'delay') {
      push({ kind: 'notice', text: `Waiting ${node.delaySeconds || 30} seconds...` });
    } else if (node.type === 'webhook') {
      push({ kind: 'notice', text: 'Connected to your app' });
    } else if (node.type === 'template') {
      const text = node.text?.trim() || `Template: ${node.templateName || 'message'}`;
      push({ kind: 'outbound', text, time, status: 'delivered' });
    } else if (node.type === 'media') {
      const caption = node.mediaCaption?.trim();
      const label = caption || `${node.mediaType || 'Media'} attachment`;
      push({ kind: 'outbound', text: node.mediaUrl?.trim() ? `📎 ${label}` : `📎 ${label}`, time, status: 'delivered' });
    } else if (node.type === 'ai') {
      const text = node.text?.trim() || 'Let me help with that...';
      push({ kind: 'outbound', text, time, status: 'read' });
    } else if (node.type === 'end') {
      const text = node.text?.trim() || 'Thank you! Have a great day.';
      push({ kind: 'outbound', text, time, status: 'read' });
    } else if (node.type === 'wa_flow') {
      const body = node.text?.trim() || 'Please fill out this form:';
      const cta = node.waFlowCta?.trim() || 'Open form';
      push({
        kind: 'buttons',
        text: body,
        buttons: [{ id: 'wa-form', title: `📝 ${cta}` }],
        time,
      });
      push({ kind: 'button_reply', text: 'Form submitted ✓', time: previewTime(seq) });
    } else {
      const text = node.text?.trim() || getNodeSummary(node);
      if (text && text !== '—') {
        push({ kind: 'outbound', text, time, status: i === selectedIndex ? 'read' : 'delivered' });
      }
    }

    i++;
  }

  return messages;
}

export function simulateMessages(
  nodes: FlowNode[],
  selectedIndex: number,
  branchChoice?: string
): Array<{ type: 'bot' | 'user'; text: string }> {
  const messages: Array<{ type: 'bot' | 'user'; text: string }> = [];
  let i = 0;

  while (i <= selectedIndex && i < nodes.length) {
    const node = nodes[i];
    const text = node.text || node.prompt || getNodeSummary(node);
    if (text) messages.push({ type: 'bot', text });

    if (node.type === 'buttons' && node.buttons?.length) {
      const btn = node.buttons.find((b) => b.id === branchChoice) || node.buttons[0];
      messages.push({ type: 'user', text: `[Taps: ${btn.title}]` });
      if (node.branches?.[btn.id]) {
        const nextIdx = nodes.findIndex((n) => n.id === node.branches![btn.id]);
        if (nextIdx > i) {
          i = nextIdx;
          continue;
        }
      }
    }

    if (node.type === 'condition') {
      messages.push({ type: 'bot', text: '↳ Condition evaluated (true path shown)' });
      if (node.branches?.true) {
        const nextIdx = nodes.findIndex((n) => n.id === node.branches!.true);
        if (nextIdx > i) {
          i = nextIdx;
          continue;
        }
      }
    }

    if (node.type === 'question') messages.push({ type: 'user', text: '[Customer reply...]' });
    if (node.type === 'tag') messages.push({ type: 'bot', text: `🏷️ Tagged as "${node.tag}"` });
    if (node.type === 'assign') messages.push({ type: 'bot', text: '👤 Assigned to agent' });
    if (node.type === 'handoff') messages.push({ type: 'bot', text: '🤝 Passed to your team' });
    if (node.type === 'delay') messages.push({ type: 'bot', text: `⏳ Waiting ${node.delaySeconds}s...` });
    if (node.type === 'webhook') messages.push({ type: 'bot', text: '🔗 Connected to your app' });
    if (node.type === 'template') messages.push({ type: 'bot', text: `📋 Template: ${node.templateName}` });
    if (node.type === 'media') messages.push({ type: 'bot', text: `📎 Media: ${node.mediaType}` });

    i++;
  }

  return messages;
}

export const TEMPLATE_COLORS: Record<string, { gradient: string; ring: string; bg: string }> = {
  violet: { gradient: 'from-violet-600 to-purple-700', ring: 'ring-violet-200/60', bg: 'bg-violet-50' },
  emerald: { gradient: 'from-whatsapp-600 to-emerald-700', ring: 'ring-emerald-200/60', bg: 'bg-emerald-50' },
  amber: { gradient: 'from-amber-500 to-orange-500', ring: 'ring-amber-200/60', bg: 'bg-amber-50' },
  sky: { gradient: 'from-sky-500 to-blue-600', ring: 'ring-sky-200/60', bg: 'bg-sky-50' },
  rose: { gradient: 'from-rose-500 to-red-600', ring: 'ring-rose-200/60', bg: 'bg-rose-50' },
};

export const NODE_CATEGORIES: Array<{ label: string; types: FlowNodeType[] }> = [
  { label: 'Messages', types: ['message', 'buttons', 'list', 'question', 'template', 'media', 'location', 'contact_card', 'wa_flow'] },
  { label: 'Do something', types: ['tag', 'remove_tag', 'assign', 'handoff', 'request_callback', 'ai', 'webhook', 'set_variable', 'goto_flow', 'goto_step', 'end'] },
  { label: 'Rules & timing', types: ['condition', 'delay', 'schedule', 'ab_split', 'language'] },
];
