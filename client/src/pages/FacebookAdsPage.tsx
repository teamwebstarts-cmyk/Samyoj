import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Eye,
  Facebook,
  FileText,
  Info,
  MousePointer2,
  Search,
  Target,
  UserRound,
} from 'lucide-react';
import FacebookAdsMetricsSkeleton from '../components/facebook/FacebookAdsMetricsSkeleton';
import PageShell from '../components/ui/PageShell';
import { useMetaChannelConnect } from '../components/layout/MetaChannelChips';
import { facebookApi } from '../services/api';
import { toastError } from '../utils/toast';
import { getErrorMessage } from '../utils/errors';
import './facebook-ads.css';
import { useMetaMock } from '../contexts/MetaMockContext';
import MetaMockNotice from '../components/meta/MetaMockNotice';
import {
  getFacebookAdsMockAccounts,
  getFacebookAdsMockCampaigns,
  getFacebookAdsMockSnapshot,
  type MockAdsCampaign,
} from '../utils/metaMockData';

type AdsPayload = Awaited<ReturnType<typeof facebookApi.adsSummary>>['data']['data'];
type AdsAccountsPayload = Awaited<ReturnType<typeof facebookApi.adsAccounts>>['data']['data'];

function formatMoney(amount: string, currency: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${amount}`;
  }
}

function accountLabel(account: { id: string; name: string | null }): string {
  const id = account.id.replace(/^act_/, '');
  return account.name ? `${account.name} (${id})` : id;
}

function EmptyArt() {
  return (
    <div className="fads-art" aria-hidden>
      <span className="fads-spark" style={{ top: 8, left: 28 }} />
      <span className="fads-spark" style={{ top: 4, right: 36, background: '#bfdbfe' }} />
      <span className="fads-spark" style={{ top: 28, right: 8, width: 6, height: 6 }} />
      <div className="fads-art-window">
        <span className="fads-art-bar" style={{ left: 22, height: 18 }} />
        <span className="fads-art-bar" style={{ left: 40, height: 32, background: '#5b9cf6' }} />
        <span className="fads-art-bar" style={{ left: 58, height: 24 }} />
        <span className="fads-art-bar" style={{ left: 76, height: 14, background: '#c5dbfb' }} />
      </div>
      <span className="fads-art-badge">
        <Facebook className="h-4 w-4" strokeWidth={2} />
      </span>
    </div>
  );
}

function Guide({
  title,
  body,
  steps,
  action,
}: {
  title: string;
  body: string;
  steps: string[];
  action?: ReactNode;
}) {
  return (
    <div className="fads-card fads-empty mt-5">
      <EmptyArt />
      <h2 className="mt-2 text-[18px] font-extrabold tracking-[-0.02em] text-[var(--fads-ink)]">{title}</h2>
      <p className="mt-1 max-w-md text-[13px] text-[var(--fads-muted)]">{body}</p>
      <ol className="mt-5 space-y-2.5 text-left">
        {steps.map((step, index) => (
          <li key={step} className="flex items-center gap-2.5 text-[13px] text-[var(--fads-ink)]">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1877F2]/10 text-[11px] font-bold text-[#1877F2]">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function MockCampaignsTable({ campaigns }: { campaigns: MockAdsCampaign[] }) {
  const [query, setQuery] = useState('');
  const rows = campaigns.filter((row) => row.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <section className="fads-card mt-3 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <h3 className="text-[15px] font-bold text-[var(--fads-ink)]">Recent ad performance</h3>
          <p className="mt-0.5 text-[12px] text-[var(--fads-muted)]">
            Sample campaigns for preview. Account totals above still come from Meta when connected.
          </p>
        </div>
        <label className="relative">
          <span className="sr-only">Search campaign name</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--fads-muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search campaign name…"
            className="h-9 w-56 rounded-xl border border-[var(--fads-line)] bg-white pl-8 pr-3 text-[13px] outline-none focus:border-[#1877F2]"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="fads-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Amount spent</th>
              <th>Impressions</th>
              <th>Clicks</th>
              <th>Leads (Meta)</th>
              <th>Cost per lead</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-[var(--fads-muted)]">No sample campaign matches that name.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="fads-thumb" style={{ background: row.hue }}>{row.name.slice(0, 1)}</span>
                      <span>
                        <span className="block font-semibold">{row.name}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-[12px] text-[var(--fads-muted)]">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              background:
                                row.status === 'Active' ? '#1F9D55' : row.status === 'Learning' ? '#F59E0B' : '#9CA3AF',
                            }}
                          />
                          {row.status}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td>{row.spend}</td>
                  <td>{row.impressions}</td>
                  <td>{row.clicks}</td>
                  <td>{row.leads}</td>
                  <td>{row.cpl}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PerformanceBoard({
  period,
  attribution,
  metrics,
  accountControl,
  pageName,
  showMockCampaigns,
}: {
  period: string;
  attribution: string;
  metrics: Array<{ label: string; value: string; icon: typeof FileText; tint: string }>;
  accountControl: ReactNode;
  pageName: string | null;
  showMockCampaigns?: boolean;
}) {
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="fads-card fads-metric">
              <div className="flex items-center gap-2">
                <span className={`fads-ico ${metric.tint}`}>
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <p className="text-[12px] font-semibold text-[var(--fads-muted)]">{metric.label}</p>
              </div>
              <p className="text-[22px] font-extrabold leading-none tracking-[-0.03em] text-[var(--fads-ink)]">
                {metric.value}
              </p>
              <p className="text-[12px] text-[var(--fads-muted)]">{period}</p>
            </article>
          );
        })}
      </div>

      <p className="fads-note mt-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1877F2]" />
        <span>
          Attribution: {attribution} (Meta). Money spent on Meta is invoiced by Meta, not part of your Samyoj plan.
        </span>
      </p>

      <section className={`fads-card mt-3 grid gap-0 ${pageName ? 'md:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.8fr)]' : ''}`}>
        <div className="px-4 py-4 sm:px-5">
          <p className="text-[14px] font-bold text-[var(--fads-ink)]">Ad account</p>
          <p className="mt-0.5 text-[12px] text-[var(--fads-muted)]">Data is shown for the selected ad account.</p>
          <div className="mt-3">{accountControl}</div>
        </div>
        {pageName ? (
          <div className="border-t border-[var(--fads-line)] px-4 py-4 md:border-l md:border-t-0 sm:px-5">
            <p className="text-[12px] font-semibold text-[var(--fads-muted)]">Connected Page</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="fads-mark text-[12px] font-bold">{pageName.slice(0, 1).toUpperCase()}</span>
                <span className="truncate text-[14px] font-bold text-[var(--fads-ink)]">{pageName}</span>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#E9F9EF] px-2 py-0.5 text-[11px] font-bold text-[#178A48]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1F9D55]" />
                Connected
              </span>
            </div>
          </div>
        ) : null}
      </section>
      {showMockCampaigns ? <MockCampaignsTable campaigns={getFacebookAdsMockCampaigns()} /> : null}
    </>
  );
}

function AdsManagerLink({ href, className }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={
        className ||
        'inline-flex h-9 items-center gap-1.5 rounded-full border border-[#d7e6fb] bg-white px-3.5 text-[13px] font-semibold text-[#1877F2]'
      }
    >
      Open Ads Manager
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

export default function FacebookAdsPage() {
  const [data, setData] = useState<AdsPayload | null>(null);
  const [accounts, setAccounts] = useState<AdsAccountsPayload | null>(null);
  const [pageName, setPageName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectingAccount, setSelectingAccount] = useState(false);
  const { canConnect, busy, startFacebookConnect } = useMetaChannelConnect();
  const { enabled: mockEnabled } = useMetaMock();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([facebookApi.adsSummary(), facebookApi.adsAccounts(), facebookApi.page()])
      .then(([summary, accountList, page]) => {
        setData(summary.data.data);
        setAccounts(accountList.data.data);
        setPageName(page.data.data.page?.name || null);
      })
      .catch((err) => toastError(getErrorMessage(err) || 'Could not load Ads insights'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, mockEnabled]);

  const realSnap = data?.status === 'ready' ? data.snapshot : null;
  const snap = realSnap ?? (mockEnabled ? getFacebookAdsMockSnapshot() : null);
  const mockMetricsOnly = Boolean(snap && !realSnap && mockEnabled);
  const period = data?.periodLabel || 'Last 7 days';
  const attribution = data?.attributionLabel || '7-day click / 1-day view';
  const subtitle = `${period} · ${attribution}. This spend is Meta’s. It is not added to your Samyoj plan, and this page cannot create or pause an ad.`;
  const mockAccounts = mockEnabled ? getFacebookAdsMockAccounts() : null;
  const accountRows =
    accounts?.accounts?.length ? accounts.accounts : mockEnabled ? mockAccounts?.accounts || [] : [];
  const selectedId =
    accounts?.selectedAccountId || snap?.adAccountId || mockAccounts?.selectedAccountId || '';
  const adsManagerHref =
    data?.adsManagerUrl ||
    (mockEnabled
      ? 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=123456789012345'
      : '');
  const displayPageName = pageName || (mockEnabled ? 'Samyoj' : null);
  const showPerformance = Boolean(snap) && (!loading || mockEnabled);
  const useMockAccountUi = mockEnabled && !accounts?.accounts?.length;

  const metrics = snap
    ? [
        {
          label: 'Amount spent',
          value: formatMoney(snap.spend, snap.currency),
          icon: FileText,
          tint: 'bg-[#E8F8EF] text-[#178A48]',
        },
        {
          label: 'Impressions',
          value: snap.impressions.toLocaleString(),
          icon: Eye,
          tint: 'bg-[#F3E8FF] text-[#7C3AED]',
        },
        {
          label: 'Clicks',
          value: snap.clicks.toLocaleString(),
          icon: MousePointer2,
          tint: 'bg-[#E8F1FF] text-[#1877F2]',
        },
        {
          label: 'Leads (Meta)',
          value: snap.leads.toLocaleString(),
          icon: UserRound,
          tint: 'bg-[#FFF1E6] text-[#EA580C]',
        },
        {
          label: 'Cost per lead',
          value: snap.cpl ? formatMoney(snap.cpl, snap.currency) : '—',
          icon: Target,
          tint: 'bg-[#FDE8F0] text-[#DB2777]',
        },
      ]
    : [];

  return (
    <PageShell>
      <div className="fads-page mx-auto w-full max-w-6xl px-1 pb-8">
        <header className={`flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start ${snap ? 'fads-header px-4 py-4 sm:px-5' : ''}`}>
          <div className="flex min-w-0 items-start gap-3">
            <span className="fads-mark mt-0.5 shrink-0">
              <Facebook className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1877F2]">Facebook · read only</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <h2 className="text-[22px] font-extrabold tracking-[-0.03em] text-[var(--fads-ink)]">Ads performance</h2>
                {mockMetricsOnly ? (
                  <span className="rounded-full bg-[#E8F1FF] px-2 py-0.5 text-[11px] font-bold text-[#1877F2]">Sample metrics</span>
                ) : null}
              </div>
              <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--fads-muted)]">{subtitle}</p>
            </div>
          </div>
          {snap && adsManagerHref ? <AdsManagerLink href={adsManagerHref} /> : null}
        </header>
        <MetaMockNotice />

        <details className="fads-card fads-disclosure mt-4">
          <summary className="fads-disclosure-trigger">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="fads-disclosure-mark" aria-hidden>
                <CircleHelp className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="text-[14px] font-bold text-[var(--fads-ink)]">What you can do here</span>
            </span>
            <ChevronDown className="fads-disclosure-chevron h-4 w-4 shrink-0 text-[var(--fads-muted)]" strokeWidth={2} />
          </summary>
          <div className="fads-disclosure-body px-4 py-3.5 text-[13px] leading-relaxed text-[var(--fads-muted)] sm:px-5">
            <ul className="list-disc space-y-1.5 pl-4 text-[var(--fads-ink)]">
              <li>Read spend, impressions, clicks, and Meta-reported leads for the connected ad account.</li>
              <li>Open Ads Manager to create, edit, or pause campaigns (Samyoj does not change ads).</li>
              <li>Switch ad accounts when your Page has access to more than one.</li>
            </ul>
            <p className="mt-3 font-semibold text-[var(--fads-ink)]">Not available in Samyoj</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Creating ads, budgets, or audiences inside this app.</li>
              <li>Billing — Meta invoices ad spend separately from your Samyoj plan.</li>
            </ul>
          </div>
        </details>

        {loading && !showPerformance ? <FacebookAdsMetricsSkeleton /> : null}

        {!loading && !snap && !mockEnabled && data?.status === 'no_page' && (
          <Guide
            title="Connect a Facebook Page first"
            body="Ads numbers come from the Page you connect. This screen never creates or pauses an ad."
            steps={[
              'Connect the Page with the button below.',
              'Share an ad account with that Page in Meta Business Settings.',
              'Come back here. Numbers appear only after Meta returns them.',
            ]}
            action={
              <button
                type="button"
                disabled={!canConnect || busy === 'fb'}
                onClick={() => void startFacebookConnect()}
                className="inline-flex h-9 items-center rounded-full bg-[#1877F2] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {busy === 'fb' ? 'Connecting…' : canConnect ? 'Connect Page' : 'Ask an admin'}
              </button>
            }
          />
        )}

        {!loading && !snap && !mockEnabled && data?.status === 'needs_permission' && (
          <Guide
            title="Ads read is not granted yet"
            body="Meta has not given this app permission to read Ads Manager. WhatsApp keeps working. This page does not invent ₹0 spend."
            steps={[
              'On the Meta app, add the Ads read use case and grant it.',
              'Reconnect the Page after that grant.',
              'This screen still cannot create or pause an ad.',
            ]}
            action={
              <button
                type="button"
                disabled={!canConnect || busy === 'fb'}
                onClick={() => void startFacebookConnect()}
                className="inline-flex h-9 items-center rounded-full bg-[#1877F2] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {busy === 'fb' ? 'Connecting…' : canConnect ? 'Reconnect Page' : 'Ask an admin'}
              </button>
            }
          />
        )}

        {!loading && !snap && !mockEnabled && (data?.status === 'error' || !data) && (
          <Guide
            title="Could not read Ads Manager"
            body="The last read failed. Numbers stay hidden until a fresh read succeeds."
            steps={['Try again in a moment.', 'If it keeps failing, reconnect the Page after Ads read is granted.']}
            action={
              <button
                type="button"
                onClick={load}
                className="inline-flex h-9 items-center rounded-full border border-[#d7e6fb] bg-white px-4 text-[13px] font-semibold text-[#1877F2]"
              >
                Try again
              </button>
            }
          />
        )}

        {!loading && !snap && !mockEnabled && data?.status === 'no_account' && (
          <Guide
            title="No ad account is shared with this Page"
            body="Until Insights returns a number, this page stays empty on purpose."
            steps={[
              'In Meta Business Settings, share an ad account with this Page.',
              'The account needs to be active.',
              'Open this page again.',
            ]}
            action={
              <a
                href="https://business.facebook.com/settings/ad-accounts"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#E8F1FF] px-4 text-[13px] font-semibold text-[#1877F2]"
              >
                Open Business Settings
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            }
          />
        )}

        {!loading && !snap && !mockEnabled && data?.adsManagerUrl ? (
          <div className="mt-4">
            <AdsManagerLink
              href={data.adsManagerUrl}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1877F2]"
            />
          </div>
        ) : null}

        {showPerformance && (
          <PerformanceBoard
            period={period}
            attribution={attribution}
            metrics={metrics}
            pageName={displayPageName}
            showMockCampaigns={mockEnabled}
            accountControl={
              useMockAccountUi && accountRows.length > 1 ? (
                <select
                  className="w-full rounded-xl border border-[var(--fads-line)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--fads-ink)] outline-none focus:border-[#1877F2]"
                  value={selectedId}
                  disabled
                >
                  {accountRows.map((account) => (
                    <option key={account.id} value={account.id}>
                      {accountLabel(account)}
                    </option>
                  ))}
                </select>
              ) : useMockAccountUi ? (
                <p className="rounded-xl border border-[var(--fads-line)] px-3 py-2.5 text-[13px] font-medium text-[var(--fads-ink)]">
                  {accountRows[0] ? accountLabel(accountRows[0]) : 'Samyoj Marketing (123456789012345)'}
                </p>
              ) : accountRows.length > 1 ? (
                <label className="block">
                  <span className="sr-only">Ad account</span>
                  <select
                    className="w-full rounded-xl border border-[var(--fads-line)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--fads-ink)] outline-none focus:border-[#1877F2]"
                    value={selectedId}
                    disabled={selectingAccount || !canConnect}
                    onChange={(event) => {
                      const accountId = event.target.value;
                      setSelectingAccount(true);
                      facebookApi
                        .selectAdsAccount(accountId)
                        .then(() => load())
                        .catch((err) => toastError(getErrorMessage(err) || 'Could not select ad account'))
                        .finally(() => setSelectingAccount(false));
                    }}
                  >
                    {accountRows.map((account) => (
                      <option key={account.id} value={account.id}>
                        {accountLabel(account)}
                      </option>
                    ))}
                  </select>
                  {!canConnect ? (
                    <span className="mt-1 block text-[12px] text-[var(--fads-muted)]">
                      Ask an owner or admin to change this.
                    </span>
                  ) : null}
                </label>
              ) : (
                <p className="rounded-xl border border-[var(--fads-line)] px-3 py-2.5 text-[13px] font-medium text-[var(--fads-ink)]">
                  {accountRows[0] ? accountLabel(accountRows[0]) : (snap?.adAccountId || '').replace(/^act_/, '')}
                </p>
              )
            }
          />
        )}
      </div>
    </PageShell>
  );
}
