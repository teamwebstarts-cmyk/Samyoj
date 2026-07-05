import { describe, expect, it } from 'vitest';
import { linkFlowNodes } from './link-nodes';
import type { FlowNode } from './types';

describe('linkFlowNodes', () => {
  it('does not auto-chain branch target message nodes by array order', () => {
    const nodes: FlowNode[] = [
      { id: 'intro', type: 'message', text: 'Hi', next: 'menu' },
      {
        id: 'menu',
        type: 'buttons',
        text: 'Choose',
        buttons: [
          { id: 'b1', title: 'One' },
          { id: 'b2', title: 'Two' },
          { id: 'b3', title: 'Three' },
        ],
        branches: {
          b1: 'reply-1',
          b2: 'reply-2',
          b3: 'reply-3',
        },
      },
      { id: 'reply-3', type: 'message', text: 'Three' },
      { id: 'reply-1', type: 'message', text: 'One' },
      { id: 'reply-2', type: 'message', text: 'Two' },
    ];

    const linked = linkFlowNodes(nodes);
    const reply1 = linked.find((n) => n.id === 'reply-1');
    const reply2 = linked.find((n) => n.id === 'reply-2');
    const reply3 = linked.find((n) => n.id === 'reply-3');

    expect(reply1?.next).toBeUndefined();
    expect(reply2?.next).toBeUndefined();
    expect(reply3?.next).toBeUndefined();
  });

  it('still links unwired linear flows by array order', () => {
    const nodes: FlowNode[] = [
      { id: 'a', type: 'message', text: 'A' },
      { id: 'b', type: 'message', text: 'B' },
      { id: 'c', type: 'end', text: 'Done' },
    ];

    const linked = linkFlowNodes(nodes);
    expect(linked[0].next).toBe('b');
    expect(linked[1].next).toBe('c');
  });
});
