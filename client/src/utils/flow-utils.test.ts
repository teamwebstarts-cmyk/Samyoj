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
});
