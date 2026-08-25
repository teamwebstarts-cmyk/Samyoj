import type { FlowNode } from './types';
import { isLinearCtaButton, nextFromCtaBranches } from './node-kind';

function collectBranchTargets(nodes: FlowNode[]): Set<string> {
  const targets = new Set<string>();
  for (const node of nodes) {
    if (node.next) targets.add(node.next);
    if (node.targetNodeId) targets.add(node.targetNodeId);
    for (const target of Object.values(node.branches || {})) {
      if (target?.trim()) targets.add(target.trim());
    }
  }
  return targets;
}

/**
 * Fill missing linear `next` pointers only.
 * Never auto-chain nodes that are explicit branch targets (fixes multi-button flows).
 */
export function linkFlowNodes(nodes: FlowNode[]): FlowNode[] {
  if (!nodes.length) return nodes;

  const branchTargets = collectBranchTargets(nodes);

  return nodes.map((node, index) => {
    const fallbackNext = index < nodes.length - 1 ? nodes[index + 1].id : undefined;
    const linearFallback = branchTargets.has(node.id) ? undefined : fallbackNext;

    if (isLinearCtaButton(node)) {
      return {
        ...node,
        branches: {},
        next: nextFromCtaBranches(node) || linearFallback,
      };
    }

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
