import { describe, expect, it, vi } from 'vitest';

vi.mock('../settings/business-hours', () => ({
  getOrgBusinessHours: vi.fn(async () => ({ startHour: 9, endHour: 18, days: [1, 2, 3, 4, 5], timezone: 'UTC' })),
  isWithinBusinessHours: vi.fn(() => true),
}));

import { simulateFlow } from './simulate';
import type { FlowNode } from './types';

describe('simulateFlow', () => {
  it('uses script detection for language branches', async () => {
    const nodes: FlowNode[] = [
      {
        id: 'lang',
        type: 'language',
        languageCode: 'hi',
        branches: { match: 'hindi', default: 'english' },
      },
      { id: 'hindi', type: 'end', text: 'Hindi' },
      { id: 'english', type: 'end', text: 'English' },
    ];

    const hi = await simulateFlow({
      organizationId: 'org',
      triggerType: 'ANY_MESSAGE',
      triggerConfig: {},
      nodes,
      startNodeId: 'lang',
      message: 'नमस्ते',
      isNewConversation: false,
    });
    expect(hi.triggered).toBe(true);
    expect(hi.steps.some((s) => s.branch === 'match')).toBe(true);

    const en = await simulateFlow({
      organizationId: 'org',
      triggerType: 'ANY_MESSAGE',
      triggerConfig: {},
      nodes,
      startNodeId: 'lang',
      message: 'hello',
      isNewConversation: false,
    });
    expect(en.steps.some((s) => s.branch === 'default')).toBe(true);
  });

  it('explains that campaign reply preview is not a live campaign lookup', async () => {
    const result = await simulateFlow({
      organizationId: 'org',
      triggerType: 'CAMPAIGN_REPLY',
      triggerConfig: {},
      nodes: [{ id: 'a', type: 'end', text: 'Thanks' }],
      message: 'hi',
      isNewConversation: false,
    });
    expect(result.triggered).toBe(true);
    expect(result.reason.toLowerCase()).toContain('preview');
    expect(result.reason.toLowerCase()).toContain('campaign');
  });
});
