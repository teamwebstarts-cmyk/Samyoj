import type { FlowNode } from './types';

export interface OutboundPreview {
  nodeId: string;
  content: string;
  buttons?: Array<{ id: string; title: string }>;
}

const SKIP_TYPES = new Set([
  'tag',
  'remove_tag',
  'assign',
  'set_variable',
  'language',
  'webhook',
  'goto_flow',
  'goto_step',
  'ab_split',
  'end',
  'handoff',
  'ai',
  'request_callback',
]);

function nextFromNode(node: FlowNode, branchKey?: string): string | null {
  if (branchKey && node.branches?.[branchKey]) return node.branches[branchKey];
  return node.next?.trim() || null;
}

/** Walk from start until the first customer-visible outbound step (for test sends). */
export function findFirstOutboundPreviewNode(
  nodes: FlowNode[],
  startNodeId?: string | null
): OutboundPreview | null {
  if (!nodes.length) return null;
  const idSet = new Set(nodes.map((n) => n.id));
  let currentId: string | null =
    startNodeId && idSet.has(startNodeId) ? startNodeId : nodes[0]?.id ?? null;
  let iterations = 0;

  while (currentId && iterations < 40) {
    iterations++;
    const node = nodes.find((n) => n.id === currentId);
    if (!node) return null;

    if (node.type === 'message' || node.type === 'question') {
      const content = (node.type === 'question' ? node.prompt : node.text)?.trim();
      if (content) return { nodeId: node.id, content };
      currentId = nextFromNode(node);
      continue;
    }

    if (node.type === 'buttons') {
      const mode = node.buttonMode || 'reply';
      if (mode === 'url' || mode === 'call') {
        currentId = nextFromNode(node);
        continue;
      }
      const content = node.text?.trim() || 'Choose an option';
      const buttons = (node.buttons || []).slice(0, 3).filter((b) => b.id && b.title);
      return { nodeId: node.id, content, buttons: buttons.length ? buttons : undefined };
    }

    if (node.type === 'list') {
      const content = node.text?.trim() || 'Choose an option';
      const firstRow = node.listSections?.flatMap((s) => s.rows).find((r) => r.id && r.title);
      const buttons = firstRow ? [{ id: firstRow.id, title: firstRow.title }] : undefined;
      return { nodeId: node.id, content, buttons };
    }

    if (node.type === 'media') {
      const content = node.mediaCaption?.trim() || node.text?.trim() || `Test ${node.mediaType || 'media'} preview`;
      return { nodeId: node.id, content };
    }

    if (node.type === 'template') {
      const content = node.text?.trim() || `Template: ${node.templateName || 'preview'}`;
      return { nodeId: node.id, content };
    }

    if (node.type === 'condition') {
      currentId = nextFromNode(node, 'true') || nextFromNode(node, 'false');
      continue;
    }

    if (SKIP_TYPES.has(node.type) || node.type === 'delay' || node.type === 'schedule') {
      currentId = nextFromNode(node);
      continue;
    }

    currentId = nextFromNode(node);
  }

  return null;
}
