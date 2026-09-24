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
    <div className="mt-6 rounded-2xl border border-neutral-100/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="text-[15px] font-bold tracking-tight text-neutral-900">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">{body}</p>
      <ol className="mt-4 space-y-2">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-2.5 text-[13px] leading-relaxed text-neutral-800">
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

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-neutral-100/90 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-neutral-500">{label}</p>
      <p className="mt-2 text-[22px] font-extrabold tracking-tight text-neutral-900">{value}</p>
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

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        <h1 className="text-[18px] font-bold tracking-tight">Ads performance</h1>
        <p className="mt-1 text-[13px] text-theme-muted">Meta's numbers. Not Samyoj revenue.</p>
        <p className="mt-1 text-[12px] font-semibold text-[#1877F2]">
          {data?.periodLabel || 'Last 7 days'} · {data?.attributionLabel || '7-day click / 1-day view'}
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
              'Come back here. Tiles appear only after Meta returns a real number.',
            ]}
            action={
              <AppButton
                size="sm"
                disabled={!canConnect || busy === 'fb'}
                onClick={() => void startFacebookConnect()}
              >
                {busy === 'fb' ? 'Connecting…' : canConnect ? 'Connect Page' : 'Ask an admin'}
              </AppButton>
            }
          />
        )}

        {!loading && !snap && data?.status === 'needs_permission' && (
          <Guide
            title="Ads read is not granted yet"
            body="Meta has not given this app permission to read Ads Manager. WhatsApp keeps working. Samyoj does not show ₹0 spend in the meantime."
            steps={[
              'On the Meta app, add the Ads read use case and grant it.',
              'Reconnect the Page after that grant. Reconnecting today will show the same Facebook message until then.',
              'This screen still cannot create or pause an ad.',
            ]}
            action={
              <AppButton
                size="sm"
                disabled={!canConnect || busy === 'fb'}
                onClick={() => void startFacebookConnect()}
              >
                {busy === 'fb' ? 'Connecting…' : canConnect ? 'Reconnect Page' : 'Ask an admin'}
              </AppButton>
            }
          />
        )}

        {!loading && !snap && (data?.status === 'error' || !data) && (
          <Guide
            title="Could not read Ads Manager"
            body="The last read failed. Existing tiles stay hidden until a fresh read succeeds."
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
            body="Until Insights returns a number, Samyoj does not show ₹0 spend."
            steps={[
              'In Meta Business Settings, share an ad account with this Page.',
              'The account needs to be active. Samyoj reads the first active one.',
              'Open this page again. Tiles show Meta’s last 7 days, not Samyoj revenue.',
            ]}
            action={
              <a
                href="https://business.facebook.com/settings/ad-accounts"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1877F2]"
              >
                Open Business Settings
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            }
          />
        )}

        {!loading && snap && (
          <>
            {accounts && accounts.accounts.length > 1 ? (
              <label className="mt-5 block max-w-md text-[12px] font-bold text-neutral-700">
                Ad account
                <select
                  className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[13px] font-medium text-neutral-900 outline-none focus:border-[#1877F2]"
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
                {!canConnect ? (
                  <span className="mt-1 block font-normal text-theme-muted">Ask an owner or admin to change this.</span>
                ) : null}
              </label>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Tile label="Spend" value={formatMoney(snap.spend, snap.currency)} />
              <Tile label="Impressions" value={snap.impressions.toLocaleString()} />
              <Tile label="Clicks" value={snap.clicks.toLocaleString()} />
              <Tile label="Leads" value={snap.leads.toLocaleString()} />
              <Tile label="CPL" value={snap.cpl ? formatMoney(snap.cpl, snap.currency) : '—'} />
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-theme-muted">
              Meta’s last 7 days for this ad account. This spend is not added to your Samyoj plan.
              {snap.cpl ? '' : ' Cost per lead shows — until Meta reports at least one lead.'}
            </p>
          </>
        )}

        {!loading && data?.adsManagerUrl && (
          <a
            href={data.adsManagerUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1877F2]"
          >
            Open Ads Manager
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </PageShell>
  );
}
