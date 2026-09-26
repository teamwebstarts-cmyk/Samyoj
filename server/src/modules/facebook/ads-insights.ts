import prisma from '../../config/database';
import { createModuleLogger } from '../../utils/logger';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { fetchAdAccountInsights, fetchPageBusinessId, listAdAccounts, type GraphAdAccount } from './page-client';
import { AppError } from '../../utils/response';

const log = createModuleLogger('facebook-ads');

export const ADS_ATTRIBUTION_LABEL = '7-day click / 1-day view';
export const ADS_PERIOD_LABEL = 'Last 7 days';
const STALE_MS = 20 * 60 * 60 * 1000;

export type AdsStatus = 'no_page' | 'no_account' | 'needs_permission' | 'ready' | 'error';

export type InsightNumbers = {
  spend: string;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
};

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function money(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

/** actions.lead, else Instant Form lead_grouped. Windows beat the unwindowed value. */
export function leadCountFromActions(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  for (const type of ['lead', 'onsite_conversion.lead_grouped']) {
    const row = actions.find(
      (item) => item && typeof item === 'object' && (item as { action_type?: string }).action_type === type
    ) as Record<string, unknown> | undefined;
    if (!row) continue;
    if (row['7d_click'] != null || row['1d_view'] != null) {
      return Math.max(0, Math.round(num(row['7d_click']) + num(row['1d_view'])));
    }
    return Math.max(0, Math.round(num(row.value)));
  }
  return 0;
}

export function cplFromSpend(spend: string, leads: number): string | null {
  if (leads <= 0) return null;
  const cents = Math.round(Number(spend) * 100);
  if (!Number.isFinite(cents)) return null;
  return (Math.round(cents / leads) / 100).toFixed(2);
}

/** Empty data is a real zero-delivery day, not a missing ad account. */
export function parseInsightsBody(body: { data?: unknown } | null | undefined): InsightNumbers {
  const rows = Array.isArray(body?.data) ? body.data : [];
  const row = (rows[0] && typeof rows[0] === 'object' ? rows[0] : {}) as Record<string, unknown>;
  const spend = money(num(row.spend));
  const leads = leadCountFromActions(row.actions);
  return {
    spend,
    impressions: Math.max(0, Math.round(num(row.impressions))),
    clicks: Math.max(0, Math.round(num(row.clicks))),
    leads,
    cpl: cplFromSpend(spend, leads),
    periodStart: typeof row.date_start === 'string' ? row.date_start : null,
    periodEnd: typeof row.date_stop === 'string' ? row.date_stop : null,
  };
}

/** Strip act_ so saved ids and Graph ids still match. */
export function adAccountKey(id: string): string {
  return id.replace(/^act_/i, '');
}

export function adAccountAvailability(
  accountStatus: number | null,
  disableReason: number | null
): 'active' | 'restricted' | 'disabled' | 'closed' {
  if (disableReason && disableReason > 0) return 'restricted';
  if (accountStatus === 2) return 'disabled';
  if (accountStatus === 100 || accountStatus === 101) return 'closed';
  return 'active';
}

/** Preferred id wins. Else the Page's business. Else first ACTIVE. */
export function pickAdAccount<
  T extends { id: string; accountStatus: number | null; businessId?: string | null },
>(rows: T[], preferredId?: string | null, pageBusinessId?: string | null): T | null {
  if (!rows.length) return null;
  if (preferredId) {
    const key = adAccountKey(preferredId);
    const preferred = rows.find((row) => adAccountKey(row.id) === key);
    if (preferred) return preferred;
  }
  const sameBusiness = pageBusinessId
    ? rows.filter((row) => row.businessId && row.businessId === pageBusinessId)
    : [];
  const pool = sameBusiness.length ? sameBusiness : rows;
  return pool.find((row) => row.accountStatus === 1) || pool[0];
}

export function adsManagerUrl(adAccountId?: string | null): string {
  const base = 'https://adsmanager.facebook.com/adsmanager/manage/campaigns';
  if (!adAccountId) return base;
  return `${base}?act=${encodeURIComponent(adAccountId.replace(/^act_/, ''))}`;
}

function adsAccessToken(
  pageTokenEncrypted: string,
  settings: Record<string, unknown>
): string {
  const meta = (settings.meta as Record<string, unknown>) || {};
  if (typeof meta.adsReadToken === 'string' && meta.adsReadToken) {
    return MetaWhatsAppService.decryptToken(meta.adsReadToken);
  }
  return MetaWhatsAppService.decryptToken(pageTokenEncrypted);
}

function isPermission(err: unknown): boolean {
  const code = (err as { metaCode?: number }).metaCode;
  if (code === 10 || code === 200 || code === 190) return true;
  const message = err instanceof Error ? err.message : '';
  return /permission|ads_read/i.test(message);
}

async function clearSnapshot(organizationId: string) {
  await prisma.metaAdsSnapshot.deleteMany({ where: { organizationId } });
}

export async function refreshOrgAdsSnapshot(organizationId: string): Promise<AdsStatus> {
  const channel = await prisma.channel.findFirst({
    where: { organizationId, platform: 'FB', isActive: true },
    select: { id: true, platformAccountId: true, accessToken: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (!channel?.accessToken) {
    await clearSnapshot(organizationId);
    return 'no_page';
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as Record<string, unknown>) || {};
  const meta = (settings.meta as Record<string, unknown>) || {};
  const pageToken = MetaWhatsAppService.decryptToken(channel.accessToken);
  const token = adsAccessToken(channel.accessToken, settings);
  const preferredAccountId = typeof meta.adsAccountId === 'string' ? meta.adsAccountId : null;
  const pageBusinessId = await fetchPageBusinessId(channel.platformAccountId, pageToken);
  let accounts: GraphAdAccount[];
  try {
    accounts = await listAdAccounts(token);
  } catch (err) {
    if (isPermission(err)) {
      await clearSnapshot(organizationId);
      return 'needs_permission';
    }
    throw err;
  }

  const account = pickAdAccount(accounts, preferredAccountId, pageBusinessId);
  if (!account) {
    await clearSnapshot(organizationId);
    return 'no_account';
  }

  let body: { data?: unknown };
  try {
    body = await fetchAdAccountInsights(account.id, token);
  } catch (err) {
    if (isPermission(err)) {
      await clearSnapshot(organizationId);
      return 'needs_permission';
    }
    throw err;
  }

  const parsed = parseInsightsBody(body);
  const data = {
    channelId: channel.id,
    adAccountId: account.id,
    currency: account.currency || 'USD',
    spend: parsed.spend,
    impressions: parsed.impressions,
    clicks: parsed.clicks,
    leads: parsed.leads,
    cpl: parsed.cpl,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    attributionLabel: ADS_ATTRIBUTION_LABEL,
    fetchedAt: new Date(),
  };
  await prisma.metaAdsSnapshot.upsert({
    where: { organizationId },
    create: { organizationId, ...data },
    update: data,
  });
  return 'ready';
}

export async function listOrgAdsAccounts(organizationId: string) {
  const channel = await prisma.channel.findFirst({
    where: { organizationId, platform: 'FB', isActive: true },
    select: { accessToken: true, platformAccountId: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (!channel?.accessToken) {
    return { status: 'no_page' as const, accounts: [], selectedAccountId: null };
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as Record<string, unknown>) || {};
  const token = adsAccessToken(channel.accessToken, settings);
  const pageToken = MetaWhatsAppService.decryptToken(channel.accessToken);
  const pageBusinessId = await fetchPageBusinessId(channel.platformAccountId, pageToken);
  let accounts: GraphAdAccount[];
  try {
    accounts = await listAdAccounts(token);
  } catch (err) {
    if (isPermission(err)) {
      return { status: 'needs_permission' as const, accounts: [], selectedAccountId: null };
    }
    throw err;
  }
  const meta = (settings.meta as Record<string, unknown>) || {};
  const saved = typeof meta.adsAccountId === 'string' ? meta.adsAccountId : null;
  const selectedAccountId = pickAdAccount(accounts, saved, pageBusinessId)?.id || null;
  return {
    status: accounts.length ? ('ready' as const) : ('no_account' as const),
    accounts: accounts.map((account) => ({
      ...account,
      availability: adAccountAvailability(account.accountStatus, account.disableReason),
    })),
    selectedAccountId,
  };
}

export async function selectOrgAdsAccount(organizationId: string, adAccountId: string) {
  const available = await listOrgAdsAccounts(organizationId);
  if (!available.accounts.some((account) => adAccountKey(account.id) === adAccountKey(adAccountId))) {
    throw new AppError(400, 'That ad account is not available to this Facebook login.');
  }
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as Record<string, unknown>) || {};
  const meta = (settings.meta as Record<string, unknown>) || {};
  await prisma.organization.update({
    where: { id: organizationId },
    data: { settings: { ...settings, meta: { ...meta, adsAccountId: adAccountId } } as object },
  });
  await refreshOrgAdsSnapshot(organizationId);
  return { selectedAccountId: adAccountId };
}

type SnapshotRow = {
  adAccountId: string;
  currency: string;
  spend: string;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  attributionLabel: string;
  fetchedAt: Date;
};

function toSummary(status: AdsStatus, snap: SnapshotRow | null) {
  const show = status === 'ready' && snap;
  return {
    status: show ? 'ready' : status === 'ready' ? 'error' : status,
    attributionLabel: ADS_ATTRIBUTION_LABEL,
    periodLabel: ADS_PERIOD_LABEL,
    adsManagerUrl: adsManagerUrl(show ? snap.adAccountId : null),
    snapshot: show
      ? {
          adAccountId: snap.adAccountId,
          currency: snap.currency,
          spend: snap.spend,
          impressions: snap.impressions,
          clicks: snap.clicks,
          leads: snap.leads,
          cpl: snap.cpl,
          periodStart: snap.periodStart,
          periodEnd: snap.periodEnd,
          attributionLabel: snap.attributionLabel,
          fetchedAt: snap.fetchedAt.toISOString(),
        }
      : null,
  };
}

export async function readAdsSummary(organizationId: string) {
  const channel = await prisma.channel.findFirst({
    where: { organizationId, platform: 'FB', isActive: true },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
  });
  const existing = await prisma.metaAdsSnapshot.findUnique({ where: { organizationId } });
  if (!channel) {
    await clearSnapshot(organizationId);
    return toSummary('no_page', null);
  }
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const meta = ((org?.settings as Record<string, unknown>)?.meta as Record<string, unknown>) || {};
  const hasExplicitAccount = typeof meta.adsAccountId === 'string' && meta.adsAccountId.length > 0;
  const stale =
    !existing ||
    existing.channelId !== channel.id ||
    Date.now() - existing.fetchedAt.getTime() > STALE_MS ||
    !hasExplicitAccount;
  let status: AdsStatus = existing?.channelId === channel.id ? 'ready' : 'no_account';
  if (stale) {
    try {
      status = await refreshOrgAdsSnapshot(organizationId);
    } catch (err) {
      log.warn('Ads insights refresh failed', {
        organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
      status = existing ? 'ready' : 'error';
    }
  }
  const snap = await prisma.metaAdsSnapshot.findUnique({ where: { organizationId } });
  return toSummary(status, snap);
}

export async function pollMetaAdsSnapshots(): Promise<void> {
  const channels = await prisma.channel.findMany({
    where: { platform: 'FB', isActive: true },
    select: { organizationId: true },
  });
  const orgIds = [...new Set(channels.map((row) => row.organizationId))];
  for (const organizationId of orgIds) {
    try {
      await refreshOrgAdsSnapshot(organizationId);
    } catch (err) {
      log.warn('Ads insights poll skipped org', {
        organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
