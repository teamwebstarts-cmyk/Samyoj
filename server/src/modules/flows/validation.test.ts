import { describe, expect, it } from 'vitest';
import { validateFlowGraph } from './validation';
import type { FlowNode } from './types';
import { FLOW_TEMPLATES } from './types';

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

  it('rejects a send loop with no wait step', () => {
    const nodes: FlowNode[] = [
      { id: 'a', type: 'message', text: 'Hi', next: 'b' },
      { id: 'b', type: 'message', text: 'Again', next: 'a' },
    ];
    const result = validateFlowGraph(nodes, 'WELCOME', {}, 'a');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('spam'))).toBe(true);
  });

  it('warns on a menu loop that waits for a button', () => {
    const nodes: FlowNode[] = [
      {
        id: 'menu',
        type: 'buttons',
        text: 'Pick',
        buttons: [{ id: 'again', title: 'Again' }],
        branches: { again: 'back' },
      },
      { id: 'back', type: 'goto_step', targetNodeId: 'menu' },
    ];
    const result = validateFlowGraph(nodes, 'WELCOME', {}, 'menu');
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('loop'))).toBe(true);
  });

  it('rejects webhook URLs that are not HTTPS public', () => {
    const nodes: FlowNode[] = [
      { id: 'a', type: 'webhook', webhookUrl: 'http://127.0.0.1/hook', next: 'b' },
      { id: 'b', type: 'end' },
    ];
    const result = validateFlowGraph(nodes, 'WELCOME', {}, 'a');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('https') || e.toLowerCase().includes('private'))).toBe(
      true
    );
  });
});

describe('FLOW_TEMPLATES still validate', () => {
  it('does not reject shipped templates as dangerous loops', () => {
    for (const template of FLOW_TEMPLATES) {
      const result = validateFlowGraph(
        template.nodes as unknown as FlowNode[],
        template.triggerType,
        template.triggerConfig as Record<string, unknown>,
        template.nodes[0]?.id
      );
      expect(result.valid, `${template.id}: ${result.errors.join('; ')}`).toBe(true);
    }
  });
});
