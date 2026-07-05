import type { FlowNode } from './types';

function branchTarget(node: FlowNode, key?: string): string | null {
  if (!key) return null;
  const target = node.branches?.[key];
  return target?.trim() ? target : null;
}

function findButtonByReply(node: FlowNode, replyId?: string, replyTitle?: string) {
  const buttons = node.buttons || [];
  if (!buttons.length) return null;

  if (replyId) {
    const trimmed = replyId.trim();
    const byId = buttons.find((b) => b.id === replyId || b.id.trim() === trimmed);
    if (byId) return byId;
    const byIdCase = buttons.find((b) => b.id.trim().toLowerCase() === trimmed.toLowerCase());
    if (byIdCase) return byIdCase;
  }

  if (replyTitle) {
    const titleLower = replyTitle.trim().toLowerCase();
    const byTitle = buttons.find((b) => b.title.trim().toLowerCase() === titleLower);
    if (byTitle) return byTitle;
  }

  return null;
}

function findListRowByReply(node: FlowNode, replyId?: string, replyTitle?: string) {
  const rows = (node.listSections || []).flatMap((s) => s.rows);
  if (!rows.length) return null;

  if (replyId) {
    const trimmed = replyId.trim();
    const byId = rows.find((r) => r.id === replyId || r.id.trim() === trimmed);
    if (byId) return byId;
    const byIdCase = rows.find((r) => r.id.trim().toLowerCase() === trimmed.toLowerCase());
    if (byIdCase) return byIdCase;
  }

  if (replyTitle) {
    const titleLower = replyTitle.trim().toLowerCase();
    const byTitle = rows.find((r) => r.title.trim().toLowerCase() === titleLower);
    if (byTitle) return byTitle;
  }

  return null;
}

/** Resolve the next step after a quick-button or list-menu tap. */
export function resolveInteractiveBranch(
  node: FlowNode,
  replyId?: string,
  replyTitle?: string
): string | null {
  if (node.type !== 'buttons' && node.type !== 'list') {
    return node.next?.trim() || null;
  }

  if (replyId) {
    const direct = branchTarget(node, replyId);
    if (direct) return direct;

    const trimmed = replyId.trim();
    const looseKey = Object.keys(node.branches || {}).find(
      (k) => k.trim() === trimmed || k.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (looseKey) {
      const loose = branchTarget(node, looseKey);
      if (loose) return loose;
    }
  }

  if (node.type === 'buttons') {
    const btn = findButtonByReply(node, replyId, replyTitle);
    if (btn) {
      const target = branchTarget(node, btn.id);
      if (target) return target;
    }
  }

  if (node.type === 'list') {
    const row = findListRowByReply(node, replyId, replyTitle);
    if (row) {
      const target = branchTarget(node, row.id);
      if (target) return target;
    }
  }

  return node.next?.trim() || null;
}

/** Ensure button ids/titles are valid and branch keys stay aligned by index. */
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

/** Match typed text to a button/list option when the customer did not tap. */
export function matchInteractiveTextIntent(node: FlowNode, content: string): string | null {
  const text = content.trim();
  if (!text) return null;

  if (node.intentRoutes?.length) {
    const lower = text.toLowerCase();
    for (const route of node.intentRoutes) {
      if (route.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
        const target = branchTarget(node, route.branchKey);
        if (target) return target;
      }
    }
  }

  return resolveInteractiveBranch(node, undefined, text);
}
