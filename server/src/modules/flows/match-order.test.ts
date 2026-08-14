import { describe, expect, it } from 'vitest';
import { partitionFlowsForMatch } from './match-order';

describe('partitionFlowsForMatch', () => {
  it('keeps ANY_MESSAGE last even when it has higher priority in the input list', () => {
    const flows = [
      { id: 'catch', triggerType: 'ANY_MESSAGE', priority: 100 },
      { id: 'kw', triggerType: 'KEYWORD', priority: 0 },
      { id: 'welcome', triggerType: 'WELCOME', priority: 10 },
    ];
    const { primary, catchAll } = partitionFlowsForMatch(flows);
    expect(primary.map((f) => f.id)).toEqual(['kw', 'welcome']);
    expect(catchAll.map((f) => f.id)).toEqual(['catch']);
  });
});
