import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({ default: {} }));

import {
  monthlyTokenLimitFromSettings,
  PLATFORM_AI_COVERAGE_NOTE,
  summarizePlatformAiUsage,
} from './orgs';

describe('platform AI coverage honesty', () => {
  it('keeps the SAMYOJ-56 incomplete-coverage note', () => {
    expect(PLATFORM_AI_COVERAGE_NOTE).toMatch(/SAMYOJ-56/);
    expect(PLATFORM_AI_COVERAGE_NOTE).toMatch(/STT\/TTS coverage is still incomplete/);
  });

  it('rolls up real caps and top orgs without inventing 131048 or AI-429 queues', () => {
    const summary = summarizePlatformAiUsage([
      {
        organizationId: 'org-1',
        companyName: 'Acme',
        aiTokensMonth: 80,
        monthlyTokenLimit: 100,
      },
      {
        organizationId: 'org-2',
        companyName: 'Beta',
        aiTokensMonth: 10,
        monthlyTokenLimit: null,
      },
    ]);

    expect(summary.tokensMonth).toBe(90);
    expect(summary.tokenLimitSum).toBe(100);
    expect(summary.cappedOrgCount).toBe(1);
    expect(summary.uncappedOrgCount).toBe(1);
    expect(summary.topOrgs[0]).toMatchObject({ organizationId: 'org-1', aiTokensMonth: 80 });
    expect(JSON.stringify(summary)).not.toMatch(/131048|AI-429/);
    expect(monthlyTokenLimitFromSettings({ ai: { monthlyTokenLimit: 5000 } })).toBe(5000);
    expect(monthlyTokenLimitFromSettings({ ai: {} })).toBeNull();
  });
});
