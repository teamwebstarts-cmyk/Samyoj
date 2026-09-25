import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ExternalLink, Eye, Facebook, FileText, Info, Loader2, MousePointer2, Target, UserRound } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import { useMetaChannelConnect } from '../components/layout/MetaChannelChips';
import { facebookApi } from '../services/api';
import { toastError } from '../utils/toast';
import { getErrorMessage } from '../utils/errors';
import './facebook-ads.css';

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

function PerformanceBoard({
  period,
  attribution,
  metrics,
  accountControl,
  pageName,
}: {
  period: string;
  attribution: string;
  metrics: Array<{ label: string; value: string; icon: typeof FileText; tint: string }>;
  accountControl: ReactNode;
  pageName: string | null;
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
  }, [load]);

  const snap = data?.status === 'ready' ? data.snapshot : null;
  const period = data?.periodLabel || 'Last 7 days';
  const attribution = data?.attributionLabel || '7-day click / 1-day view';
  const subtitle = `${period} · ${attribution}. This spend is Meta’s. It is not added to your Samyoj plan, and this page cannot create or pause an ad.`;
  const accountRows = accounts?.accounts || [];
  const selectedId = accounts?.selectedAccountId || snap?.adAccountId || '';

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
        <header className={`flex items-start justify-between gap-4 ${snap ? 'fads-header px-4 py-4 sm:px-5' : ''}`}>
          <div className="flex min-w-0 items-start gap-3">
            <span className="fads-mark mt-0.5 shrink-0">
              <Facebook className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1877F2]">Facebook · read only</p>
              <h2 className="mt-0.5 text-[22px] font-extrabold tracking-[-0.03em] text-[var(--fads-ink)]">Ads performance</h2>
              <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--fads-muted)]">{subtitle}</p>
            </div>
          </div>
          {snap && data?.adsManagerUrl ? <AdsManagerLink href={data.adsManagerUrl} /> : null}
        </header>

        {loading && (
          <div className="flex justify-center py-16 text-[var(--fads-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {!loading && !snap && data?.status === 'no_page' && (
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

        {!loading && !snap && data?.status === 'needs_permission' && (
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

        {!loading && !snap && (data?.status === 'error' || !data) && (
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

        {!loading && !snap && data?.status === 'no_account' && (
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

        {!loading && !snap && data?.adsManagerUrl ? (
          <div className="mt-4">
            <AdsManagerLink
              href={data.adsManagerUrl}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1877F2]"
            />
          </div>
        ) : null}

        {!loading && snap && (
          <PerformanceBoard
            period={period}
            attribution={attribution}
            metrics={metrics}
            pageName={pageName}
            accountControl={
              accountRows.length > 1 ? (
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
                  {accountRows[0] ? accountLabel(accountRows[0]) : snap.adAccountId.replace(/^act_/, '')}
                </p>
              )
            }
          />
        )}
      </div>
    </PageShell>
  );
}
