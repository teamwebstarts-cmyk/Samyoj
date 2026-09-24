import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import AppButton from '../components/ui/AppButton';
import { useMetaChannelConnect } from '../components/layout/MetaChannelChips';
import { facebookApi } from '../services/api';
import { toastError } from '../utils/toast';
import { getErrorMessage } from '../utils/errors';

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
    <div className="dashboard-card mt-6 p-5">
      <p className="text-[15px] font-bold tracking-tight text-theme-fg">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-theme-muted">{body}</p>
      <ol className="mt-4 space-y-2">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-2.5 text-[13px] leading-relaxed text-theme-fg">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1877F2]/10 text-[11px] font-bold text-[#1877F2]">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export default function FacebookAdsPage() {
  const [data, setData] = useState<AdsPayload | null>(null);
  const [accounts, setAccounts] = useState<AdsAccountsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectingAccount, setSelectingAccount] = useState(false);
  const { canConnect, busy, startFacebookConnect } = useMetaChannelConnect();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([facebookApi.adsSummary(), facebookApi.adsAccounts()])
      .then(([summary, accountList]) => {
        setData(summary.data.data);
        setAccounts(accountList.data.data);
      })
      .catch((err) => toastError(getErrorMessage(err) || 'Could not load Ads insights'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const snap = data?.status === 'ready' ? data.snapshot : null;
  const facts = snap
    ? [
        ['Impressions', snap.impressions.toLocaleString()],
        ['Clicks', snap.clicks.toLocaleString()],
        ['Leads', snap.leads.toLocaleString()],
        ['Cost per lead', snap.cpl ? formatMoney(snap.cpl, snap.currency) : '—'],
      ]
    : [];

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1877F2]">Facebook · read only</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-tight text-theme-fg">Ads performance</h1>
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-theme-muted">
          {data?.periodLabel || 'Last 7 days'} · {data?.attributionLabel || '7-day click / 1-day view'}. This spend is Meta’s. It is not added to your Samyoj plan, and this page cannot create or pause an ad.
        </p>

        {loading && (
          <div className="flex justify-center py-16 text-theme-muted">
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
              <AppButton size="sm" disabled={!canConnect || busy === 'fb'} onClick={() => void startFacebookConnect()}>
                {busy === 'fb' ? 'Connecting…' : canConnect ? 'Connect Page' : 'Ask an admin'}
              </AppButton>
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
              <AppButton size="sm" disabled={!canConnect || busy === 'fb'} onClick={() => void startFacebookConnect()}>
                {busy === 'fb' ? 'Connecting…' : canConnect ? 'Reconnect Page' : 'Ask an admin'}
              </AppButton>
            }
          />
        )}

        {!loading && !snap && (data?.status === 'error' || !data) && (
          <Guide
            title="Could not read Ads Manager"
            body="The last read failed. Numbers stay hidden until a fresh read succeeds."
            steps={['Try again in a moment.', 'If it keeps failing, reconnect the Page after Ads read is granted.']}
            action={
              <AppButton size="sm" variant="secondary" onClick={load}>
                Try again
              </AppButton>
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
                className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1877F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1877F2]"
              >
                Open Business Settings
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            }
          />
        )}

        {!loading && snap && (
          <div className="dashboard-card mt-6 overflow-hidden">
            <div className="border-l-[3px] border-[#1877F2] px-5 py-5">
              <p className="text-[12px] font-semibold text-theme-muted">Spend</p>
              <p className="mt-1 text-[40px] font-bold leading-none tracking-tight text-theme-fg">
                {formatMoney(snap.spend, snap.currency)}
              </p>
            </div>
            <dl className="grid grid-cols-2 border-t border-theme-border sm:grid-cols-4">
              {facts.map(([label, value]) => (
                <div key={label} className="border-theme-border px-4 py-3 sm:border-l sm:first:border-l-0">
                  <dt className="text-[11px] font-semibold text-theme-muted">{label}</dt>
                  <dd className="mt-1 text-[16px] font-bold text-theme-fg">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-theme-border px-4 py-3">
              {accounts && accounts.accounts.length > 1 ? (
                <label className="min-w-[14rem] flex-1 text-[12px] font-semibold text-theme-muted">
                  Ad account
                  <select
                    className="mt-1 w-full rounded-xl border border-theme-border bg-theme-surface px-3 py-2 text-[13px] font-medium text-theme-fg outline-none focus:border-[#1877F2]"
                    value={accounts.selectedAccountId || snap.adAccountId}
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
                    {accounts.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name || account.id} · {account.currency || 'currency unavailable'}
                      </option>
                    ))}
                  </select>
                  {!canConnect ? <span className="mt-1 block font-normal">Ask an owner or admin to change this.</span> : null}
                </label>
              ) : (
                <p className="text-[12px] text-theme-muted">One ad account for this organization.</p>
              )}
              {data?.adsManagerUrl ? (
                <a
                  href={data.adsManagerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1877F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1877F2]"
                >
                  Open Ads Manager
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          </div>
        )}

        {!loading && !snap && data?.adsManagerUrl ? (
          <a
            href={data.adsManagerUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1877F2]"
          >
            Open Ads Manager
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </PageShell>
  );
}
