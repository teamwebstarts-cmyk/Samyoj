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
  listAdAccounts: vi.fn(),
  fetchAdAccountInsights: vi.fn(),
  fetchPageBusinessId: vi.fn().mockResolvedValue(null),
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

  it('prefers the Page business over the first personal ACTIVE account', () => {
    const picked = pickAdAccount(
      [
        { id: 'act_anurag', accountStatus: 1, businessId: 'biz_personal' },
        { id: 'act_locked', accountStatus: 2, businessId: 'biz_page' },
        { id: 'act_team', accountStatus: 1, businessId: 'biz_page' },
      ],
      null,
      'biz_page'
    );
    expect(picked?.id).toBe('act_team');
  });

  it('keeps an explicit picker choice even when another account matches the Page', () => {
    const picked = pickAdAccount(
      [
        { id: 'act_anurag', accountStatus: 1, businessId: 'biz_personal' },
        { id: 'act_2640198749746466', accountStatus: 1, businessId: 'biz_page' },
      ],
      '2640198749746466',
      'biz_page'
    );
    expect(picked?.id).toBe('act_2640198749746466');
  });

  it('no ad account clears the snapshot and does not write zeros', async () => {
    const { listAdAccounts } = await import('./page-client');
    vi.mocked(listAdAccounts).mockResolvedValue([]);
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

  it('lists ad accounts with the stored user token, not the Page token', async () => {
    const { listAdAccounts, fetchAdAccountInsights } = await import('./page-client');
    const { MetaWhatsAppService } = await import('../whatsapp/meta.service');
    vi.mocked(MetaWhatsAppService.decryptToken).mockImplementation((value: string) =>
      value === 'enc-user' ? 'user-token' : 'page-token'
    );
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      settings: { meta: { adsReadToken: 'enc-user' } },
    } as never);
    vi.mocked(listAdAccounts).mockResolvedValue([
      {
        id: 'act_264',
        name: 'teamsamyoj',
        currency: 'INR',
        accountStatus: 1,
        disableReason: 0,
        businessId: 'biz_page',
        businessName: 'teamsamyoj',
      },
    ]);
    vi.mocked(fetchAdAccountInsights).mockResolvedValue({ data: [] });
    channelMock.findFirst.mockResolvedValue({
      id: 'ch',
      platformAccountId: 'page_1',
      accessToken: 'enc-page',
    } as never);
    snapshotMock.upsert.mockResolvedValue({} as never);

    const status = await refreshOrgAdsSnapshot('org_1');
    expect(status).toBe('ready');
    expect(listAdAccounts).toHaveBeenCalledWith('user-token');
    expect(fetchAdAccountInsights).toHaveBeenCalledWith('act_264', 'user-token');
  });

  it('auto-picks the ad account in the connected Page business', async () => {
    const { listAdAccounts, fetchAdAccountInsights, fetchPageBusinessId } = await import('./page-client');
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ settings: {} } as never);
    vi.mocked(fetchPageBusinessId).mockResolvedValue('biz_page');
    vi.mocked(listAdAccounts).mockResolvedValue([
      {
        id: 'act_anurag',
        name: 'Anurag Mourya',
        currency: 'INR',
        accountStatus: 1,
        disableReason: 0,
        businessId: 'biz_other',
        businessName: 'Anurag',
      },
      {
        id: 'act_team',
        name: 'teamsamyoj',
        currency: 'INR',
        accountStatus: 1,
        disableReason: 0,
        businessId: 'biz_page',
        businessName: 'teamsamyoj',
      },
    ]);
    vi.mocked(fetchAdAccountInsights).mockResolvedValue({ data: [] });
    channelMock.findFirst.mockResolvedValue({
      id: 'ch',
      platformAccountId: 'page_1',
      accessToken: 'enc-page',
    } as never);
    snapshotMock.upsert.mockResolvedValue({} as never);

    const status = await refreshOrgAdsSnapshot('org_1');
    expect(status).toBe('ready');
    expect(fetchAdAccountInsights).toHaveBeenCalledWith('act_team', 'page-token');
  });

  it('routes are read-only and OAuth asks ads_read, not ads_management', () => {
    const routes = readFileSync(join(__dirname, 'routes.ts'), 'utf8');
    const oauth = readFileSync(join(__dirname, 'connect-oauth-state.ts'), 'utf8');
    const insights = readFileSync(join(__dirname, 'ads-insights.ts'), 'utf8');
    const client = readFileSync(join(__dirname, 'page-client.ts'), 'utf8');
    expect(routes).toContain("'/ads-summary'");
    expect(routes).toContain("'/ads-account'");
    expect(routes).not.toMatch(/\/ads-(?:create|pause|resume|delete)/);
    expect(oauth).toContain('ads_read');
    const scopes = oauth.slice(oauth.indexOf('FACEBOOK_PAGE_LEADGEN_SCOPES'), oauth.indexOf('.join'));
    expect(scopes).not.toContain('ads_management');
    expect(insights).not.toContain('activatePlan');
    expect(insights).not.toContain('ads_management');
    expect(client).toContain('/me/adaccounts');
    expect(client).not.toContain('assigned_ad_accounts');
    expect(client).toContain('export async function listAdAccounts');
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
