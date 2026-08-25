import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { FlowNode } from '../types';
import {
  applyGraphConnections,
  getNodeHandles,
  isBranchingFlowNode,
} from '../components/flows/flowGraphUtils';

describe('flow canvas graph contract', () => {
  it('treats URL and call buttons as linear next, not branches', () => {
    const url: FlowNode = { id: 'url', type: 'buttons', buttonMode: 'url' };
    const call: FlowNode = { id: 'call', type: 'buttons', buttonMode: 'call' };
    const reply: FlowNode = { id: 'reply', type: 'buttons', buttonMode: 'reply', buttons: [{ id: 'a', title: 'A' }] };

    expect(isBranchingFlowNode(url)).toBe(false);
    expect(isBranchingFlowNode(call)).toBe(false);
    expect(isBranchingFlowNode(reply)).toBe(true);
    expect(getNodeHandles(url)).toEqual([{ id: 'next', label: 'Next' }]);
  });

  it('writes URL/call canvas wires onto node.next', () => {
    const nodes: FlowNode[] = [
      { id: 'url', type: 'buttons', buttonMode: 'url', text: 'Visit' },
      { id: 'end', type: 'end', text: 'Done' },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'url', target: 'end', sourceHandle: 'next' },
    ];
    const { nodes: updated } = applyGraphConnections(nodes, edges, 'url');
    const url = updated.find((n) => n.id === 'url');
    expect(url?.next).toBe('end');
    expect(url?.branches).toBeUndefined();
  });

  it('labels A/B handles from splitRatio', () => {
    const handles = getNodeHandles({ id: 'ab', type: 'ab_split', splitRatio: 70 });
    expect(handles).toEqual([
      { id: 'a', label: 'A (70%)' },
      { id: 'b', label: 'B (30%)' },
    ]);
  });
});
