import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import prisma from '../../config/database';
import {
  cplFromSpend,
  leadCountFromActions,
  parseInsightsBody,
  pickAdAccount,
  refreshOrgAdsSnapshot,
} from './ads-insights';

vi.mock('../../config/database', () => ({
  default: {
    channel: { findFirst: vi.fn(), findMany: vi.fn() },
    organization: { findUnique: vi.fn().mockResolvedValue({ settings: {} }) },
    metaAdsSnapshot: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock('../whatsapp/meta.service', () => ({
  MetaWhatsAppService: { decryptToken: vi.fn(() => 'page-token') },
}));

vi.mock('./page-client', () => ({
  listAdAccountsForPage: vi.fn(),
  fetchAdAccountInsights: vi.fn(),
}));

const channelMock = vi.mocked(prisma.channel);
const snapshotMock = vi.mocked(prisma.metaAdsSnapshot);

describe('Phase 5 Ads insights parse', () => {
  it('uses 7d_click + 1d_view for lead, ignores link clicks, CPL is spend/leads', () => {
    const parsed = parseInsightsBody({
      data: [
        {
          spend: '10',
          impressions: '100',
          clicks: '8',
          date_start: '2026-09-17',
          date_stop: '2026-09-24',
          actions: [
            { action_type: 'link_click', value: '8' },
            { action_type: 'lead', value: '9', '7d_click': '2', '1d_view': '1' },
          ],
        },
      ],
    });
    expect(parsed.leads).toBe(3);
    expect(parsed.cpl).toBe('3.33');
    expect(parsed.spend).toBe('10.00');
    expect(leadCountFromActions([{ action_type: 'link_click', value: '4' }])).toBe(0);
    expect(cplFromSpend('10.00', 0)).toBeNull();
  });

  it('empty insights data is a zero day, not a crash', () => {
    const parsed = parseInsightsBody({ data: [] });
    expect(parsed).toMatchObject({ spend: '0.00', impressions: 0, clicks: 0, leads: 0, cpl: null });
  });

  it('prefers the active ad account', () => {
    const picked = pickAdAccount([
      { id: 'act_old', accountStatus: 2 },
      { id: 'act_live', accountStatus: 1 },
    ]);
    expect(picked?.id).toBe('act_live');
  });

  it('no ad account clears the snapshot and does not write zeros', async () => {
    const { listAdAccountsForPage } = await import('./page-client');
    vi.mocked(listAdAccountsForPage).mockResolvedValue([]);
    channelMock.findFirst.mockResolvedValue({
      id: 'ch',
      platformAccountId: 'page_1',
      accessToken: 'enc',
    } as never);
    snapshotMock.deleteMany.mockResolvedValue({ count: 1 } as never);

    const status = await refreshOrgAdsSnapshot('org_1');
    expect(status).toBe('no_account');
    expect(snapshotMock.deleteMany).toHaveBeenCalled();
    expect(snapshotMock.upsert).not.toHaveBeenCalled();
  });

  it('routes are read-only and OAuth asks ads_read, not ads_management', () => {
    const routes = readFileSync(join(__dirname, 'routes.ts'), 'utf8');
    const oauth = readFileSync(join(__dirname, 'connect-oauth-state.ts'), 'utf8');
    const insights = readFileSync(join(__dirname, 'ads-insights.ts'), 'utf8');
    expect(routes).toContain("'/ads-summary'");
    expect(routes).toContain("'/ads-account'");
    expect(routes).not.toMatch(/\/ads-(?:create|pause|resume|delete)/);
    expect(oauth).toContain('ads_read');
    const scopes = oauth.slice(oauth.indexOf('FACEBOOK_PAGE_LEADGEN_SCOPES'), oauth.indexOf('.join'));
    expect(scopes).not.toContain('ads_management');
    expect(insights).not.toContain('activatePlan');
    expect(insights).not.toContain('ads_management');
  });
});

describe('refresh isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('still prefers active account after clear', () => {
    expect(pickAdAccount([{ id: 'a', accountStatus: null }])?.id).toBe('a');
  });
});
