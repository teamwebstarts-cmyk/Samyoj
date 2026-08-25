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

  it('rejects incomplete conditions and duplicate button IDs', () => {
    const result = validateFlowGraph(
      [
        { id: 'condition', type: 'condition', conditionType: 'has_tag', branches: { true: 'end', false: 'end' } },
        {
          id: 'buttons',
          type: 'buttons',
          text: 'Pick',
          buttons: [
            { id: 'same', title: 'One' },
            { id: 'same', title: 'Two' },
          ],
          branches: { same: 'end' },
        },
        { id: 'end', type: 'end' },
      ],
      'WELCOME',
      {},
      'condition'
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('needs a tag'))).toBe(true);
    expect(result.errors.some((e) => e.includes('unique IDs'))).toBe(true);
  });

  it('enforces HTTPS CTA and wait limits', () => {
    const result = validateFlowGraph(
      [
        { id: 'buttons', type: 'buttons', buttonMode: 'url', ctaUrl: 'http://example.com', next: 'delay' },
        { id: 'delay', type: 'delay', delaySeconds: 86401, next: 'schedule' },
        { id: 'schedule', type: 'schedule', delaySeconds: 604801, next: 'end' },
        { id: 'end', type: 'end' },
      ],
      'WELCOME',
      {},
      'buttons'
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('must use HTTPS'))).toBe(true);
    expect(result.errors.some((e) => e.includes('24 hours'))).toBe(true);
    expect(result.errors.some((e) => e.includes('7 days'))).toBe(true);
  });

  it('accepts a valid seven-day schedule and rejects malformed dates', () => {
    const valid = validateFlowGraph(
      [{ id: 'schedule', type: 'schedule', delaySeconds: 604800 }],
      'WELCOME',
      {},
      'schedule'
    );
    expect(valid.valid).toBe(true);

    const invalid = validateFlowGraph(
      [{ id: 'schedule', type: 'schedule', scheduleAt: 'not-a-date' }],
      'WELCOME',
      {},
      'schedule'
    );
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.some((e) => e.includes('invalid date'))).toBe(true);
  });

  it('rejects invalid start steps and invalid location/contact values', () => {
    const result = validateFlowGraph(
      [
        {
          id: 'location',
          type: 'location',
          latitude: 91,
          longitude: 181,
          next: 'contact',
        },
        {
          id: 'contact',
          type: 'contact_card',
          contactName: 'Support',
          contactPhone: '123',
        },
      ],
      'WELCOME',
      {},
      'missing'
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Start step'))).toBe(true);
    expect(result.errors.some((e) => e.includes('invalid coordinates'))).toBe(true);
    expect(result.errors.some((e) => e.includes('valid phone number'))).toBe(true);
  });

  it('rejects menu steps that can wait forever without a usable reply', () => {
    const result = validateFlowGraph(
      [
        { id: 'menu', type: 'list', text: 'Choose', listSections: [{ rows: [] }] },
      ],
      'WELCOME',
      {},
      'menu'
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('at least one row'))).toBe(true);
  });

  it('caps graph size before execution', () => {
    const nodes: FlowNode[] = Array.from({ length: 101 }, (_, i) => ({
      id: `node-${i}`,
      type: 'message',
      text: 'step',
    }));
    const result = validateFlowGraph(nodes, 'WELCOME', {}, nodes[0].id);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('100 steps'))).toBe(true);
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
