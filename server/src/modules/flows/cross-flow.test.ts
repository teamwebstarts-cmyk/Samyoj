import { describe, expect, it } from 'vitest';
import { MAX_CROSS_FLOW_HOPS, blockedGotoFlowReason } from './cross-flow';

describe('blockedGotoFlowReason', () => {
  it('blocks a cycle back into a flow already on the path', () => {
    expect(blockedGotoFlowReason(['a', 'b'], 1, 'a')).toBe('cycle');
  });

  it('blocks after the hop cap even when the target is new', () => {
    expect(blockedGotoFlowReason(['a'], MAX_CROSS_FLOW_HOPS, 'z')).toBe('hop_limit');
  });

  it('allows a new target under the hop cap', () => {
    expect(blockedGotoFlowReason(['a'], 0, 'b')).toBeNull();
  });
});
