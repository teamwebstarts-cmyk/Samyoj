/**
 * ANY_MESSAGE is a catch-all: it must only run when no other published flow matched.
 * Priority still orders flows *within* each group.
 */
export function partitionFlowsForMatch<T extends { triggerType: string }>(flows: T[]): {
  primary: T[];
  catchAll: T[];
} {
  const primary: T[] = [];
  const catchAll: T[] = [];
  for (const flow of flows) {
    if (flow.triggerType === 'ANY_MESSAGE') {
      catchAll.push(flow);
    } else {
      primary.push(flow);
    }
  }
  return { primary, catchAll };
}
