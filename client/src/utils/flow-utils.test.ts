import { describe, expect, it } from 'vitest';
import type { FlowNode } from '../types';
import { prepareNodesForSave, validateFlow } from '../components/flows/flowUtils';

describe('flow builder validation', () => {
  it('normalizes legacy conditions before saving', () => {
    const [node] = prepareNodesForSave([{ id: 'condition', type: 'condition', branches: {} }]);
    expect(node.conditionType).toBe('business_hours');
  });

  it('catches unsafe CTA URLs before the API request', () => {
    const errors = validateFlow('Demo', 'WELCOME', {}, '', [
      { id: 'buttons', type: 'buttons', text: 'Choose', buttonMode: 'url', ctaUrl: 'http://example.com' },
    ]);
    expect(errors).toContain('Website links must use HTTPS');
  });

  it('catches invalid schedule and delay limits locally', () => {
    const nodes: FlowNode[] = [
      { id: 'delay', type: 'delay', delaySeconds: 86401 },
      { id: 'schedule', type: 'schedule', scheduleAt: 'invalid', delaySeconds: 604801 },
    ];
    const errors = validateFlow('Demo', 'WELCOME', {}, '', nodes);
    expect(errors).toContain('Wait step cannot exceed 24 hours');
    expect(errors).toContain('Enter a valid schedule date and time');
    expect(errors).toContain('Schedule step cannot exceed 7 days');
  });

  it('migrates URL/call canvas branches.next onto node.next before save', () => {
    const [node] = prepareNodesForSave([
      {
        id: 'url',
        type: 'buttons',
        buttonMode: 'url',
        text: 'Visit',
        ctaUrl: 'https://example.com',
        branches: { next: 'end' },
      },
      { id: 'other', type: 'message', text: 'Not the target' },
      { id: 'end', type: 'end', text: 'Done' },
    ]);
    expect(node.next).toBe('end');
    expect(node.branches).toEqual({});
  });

  it('catches missing jump targets and non-HTTPS media/webhook URLs', () => {
    const errors = validateFlow('Demo', 'WELCOME', {}, '', [
      { id: 'media', type: 'media', mediaUrl: 'http://cdn.example.com/a.png' },
      { id: 'webhook', type: 'webhook', webhookUrl: 'http://example.com/hook' },
      { id: 'goto_flow', type: 'goto_flow', targetFlowId: '' },
      { id: 'goto_step', type: 'goto_step', targetNodeId: 'missing' },
    ]);
    expect(errors).toContain('Media links must use HTTPS');
    expect(errors).toContain('Connect-to-app links must use HTTPS');
    expect(errors).toContain('Jump to Flow needs a published flow');
    expect(errors).toContain('Jump to Step points to a missing step');
  });
});
