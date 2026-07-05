import { describe, expect, it } from 'vitest';
import { resolveInteractiveBranch, syncButtonNode } from './branch-resolve';
import type { FlowNode } from './types';

describe('resolveInteractiveBranch', () => {
  const node: FlowNode = {
    id: 'menu',
    type: 'buttons',
    text: 'Choose',
    buttons: [
      { id: 'btn-a', title: 'One' },
      { id: 'btn-b', title: 'Two' },
      { id: 'btn-c', title: 'Three' },
    ],
    branches: {
      'btn-a': 'step-a',
      'btn-b': 'step-b',
      'btn-c': 'step-c',
    },
  };

  it('resolves by exact button id', () => {
    expect(resolveInteractiveBranch(node, 'btn-c')).toBe('step-c');
  });

  it('resolves by button title when id differs', () => {
    expect(resolveInteractiveBranch(node, 'unknown-id', 'Three')).toBe('step-c');
  });

  it('syncs branch keys when button ids change by index', () => {
    const synced = syncButtonNode({
      ...node,
      buttons: [
        { id: 'btn-a', title: 'One' },
        { id: 'btn-b', title: 'Two' },
        { id: 'btn-new-3', title: 'Three' },
      ],
      branches: {
        'btn-a': 'step-a',
        'btn-b': 'step-b',
        'btn-old-3': 'step-c',
      },
    });
    expect(synced.branches?.['btn-new-3']).toBe('step-c');
  });
});
