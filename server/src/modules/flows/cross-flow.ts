export const MAX_CROSS_FLOW_HOPS = 10;

/** Block goto_flow when the target is already on the path or the hop cap is hit. */
export function blockedGotoFlowReason(
  flowPath: Iterable<string>,
  hops: number,
  targetFlowId: string
): 'cycle' | 'hop_limit' | null {
  const path = flowPath instanceof Set ? flowPath : new Set(flowPath);
  if (path.has(targetFlowId)) return 'cycle';
  if (hops >= MAX_CROSS_FLOW_HOPS) return 'hop_limit';
  return null;
}
