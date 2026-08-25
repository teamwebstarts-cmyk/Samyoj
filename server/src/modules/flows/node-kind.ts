import type { FlowNode } from './types';

/** URL and call buttons are linear: the engine continues via `next`, not `branches`. */
export function isLinearCtaButton(node: Pick<FlowNode, 'type' | 'buttonMode'>): boolean {
  return node.type === 'buttons' && (node.buttonMode === 'url' || node.buttonMode === 'call');
}

export function nextFromCtaBranches(node: Pick<FlowNode, 'next' | 'branches'>): string | undefined {
  return node.next || node.branches?.next?.trim() || undefined;
}
