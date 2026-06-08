import { describe, expect, it } from 'vitest';
import { validateFlowGraph } from './validation';
import type { FlowNode } from './types';

const linearFlow: FlowNode[] = [
  { id: 'a', type: 'message', text: 'Hi', next: 'b' },
  { id: 'b', type: 'end', text: 'Bye' },
];

describe('validateFlowGraph', () => {
  it('accepts valid linear flow', () => {
    const result = validateFlowGraph(linearFlow, 'WELCOME', {}, 'a');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('requires keyword for KEYWORD trigger', () => {
    const result = validateFlowGraph(linearFlow, 'KEYWORD', {}, 'a');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Keyword'))).toBe(true);
  });

  it('warns about unreachable nodes', () => {
    const nodes: FlowNode[] = [
      { id: 'a', type: 'message', text: 'Hi', next: 'b' },
      { id: 'b', type: 'end', text: 'Bye' },
      { id: 'orphan', type: 'message', text: 'Never reached' },
    ];
    const result = validateFlowGraph(nodes, 'WELCOME', {}, 'a');
    expect(result.warnings.some((w) => w.includes('unreachable'))).toBe(true);
  });

  it('errors on broken references', () => {
    const nodes: FlowNode[] = [
      { id: 'a', type: 'message', text: 'Hi', next: 'missing' },
    ];
    const result = validateFlowGraph(nodes, 'WELCOME', {}, 'a');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('missing'))).toBe(true);
  });
});
