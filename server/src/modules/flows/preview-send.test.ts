import { describe, expect, it } from 'vitest';
import { findFirstOutboundPreviewNode } from './preview-send';
import type { FlowNode } from './types';

describe('findFirstOutboundPreviewNode', () => {
  const nodes: FlowNode[] = [
    { id: 'start', type: 'tag', tag: 'lead', next: 'msg' },
    { id: 'msg', type: 'message', text: 'Hello from test', next: 'end' },
    { id: 'end', type: 'end' },
  ];

  it('skips non-outbound steps and returns the first message', () => {
    const preview = findFirstOutboundPreviewNode(nodes, 'start');
    expect(preview).toEqual({ nodeId: 'msg', content: 'Hello from test' });
  });

  it('returns buttons preview with quick replies', () => {
    const buttonNodes: FlowNode[] = [
      {
        id: 'menu',
        type: 'buttons',
        text: 'Pick one',
        buttons: [
          { id: 'a', title: 'A' },
          { id: 'b', title: 'B' },
        ],
      },
    ];
    expect(findFirstOutboundPreviewNode(buttonNodes)).toEqual({
      nodeId: 'menu',
      content: 'Pick one',
      buttons: [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
      ],
    });
  });
});
