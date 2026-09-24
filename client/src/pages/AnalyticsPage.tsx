import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import AppButton from '../components/ui/AppButton';
import { analyticsApi, leadApi } from '../services/api';
import { toastError } from '../utils/toast';
import { getErrorMessage } from '../utils/errors';

type Payload = {
  meta: {
    spend: string;
    metaLeads: number;
    cpl: string | null;
    currency: string;
    periodLabel: string;
    attributionLabel: string;
  } | null;
  pipeline: {
    qualified: number;
    won: number;
    revenue: string | null;
    note: string | null;
    wonLeads: Array<{ id: string; title: string; amount: string | null }>;
  };
  filters: { facebook: boolean; instagram: boolean; whatsapp: boolean };
};

function money(amount: string | null, currency: string): string {
  if (!amount) return '—';
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${amount}`;
  }
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { platform };
    if (from) params.from = new Date(from).toISOString();
    if (to) params.to = new Date(`${to}T23:59:59`).toISOString();
    analyticsApi
      .metaPipeline(params)
      .then((res) => setData(res.data.data))
      .catch((err) => toastError(getErrorMessage(err) || 'Could not load analytics'))
      .finally(() => setLoading(false));
  }, [from, platform, to]);

  useEffect(() => {
    load();
  }, [load]);

  const saveAmount = (id: string, current: string | null) => {
    const raw = drafts[id] ?? current ?? '';
    const amount = raw.trim() === '' ? null : Number(raw);
    if (amount != null && !Number.isFinite(amount)) return;
    leadApi
      .update(id, { amount })
      .then(() => load())
      .catch((err) => toastError(getErrorMessage(err) || 'Could not save amount'));
  };

  const platforms = [
    { id: 'all', label: 'All form leads' },
    ...(data?.filters.facebook ? [{ id: 'facebook', label: 'Facebook' }] : []),
    ...(data?.filters.instagram ? [{ id: 'instagram', label: 'Instagram' }] : []),
    ...(data?.filters.whatsapp ? [{ id: 'whatsapp', label: 'WhatsApp' }] : []),
  ];
  const currency = data?.meta?.currency || 'INR';

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-[22px] font-bold tracking-tight text-theme-fg">Analytics</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-theme-muted">
          Two ledgers, kept apart. Meta’s ad snapshot does not use the date filter. The amounts you type on won leads are yours, and they are not added to Meta spend.
        </p>

        {loading ? (
          <div className="flex justify-center py-16 text-theme-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="dashboard-card border-t-[3px] border-t-[#1877F2] p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1877F2]">Meta</p>
              <h2 className="mt-1 text-[18px] font-bold text-theme-fg">Ad snapshot</h2>
              <p className="mt-1 text-[12px] text-theme-muted">
                Fixed window: {data?.meta?.periodLabel || 'Last 7 days'} · {data?.meta?.attributionLabel || '7-day click / 1-day view'}
              </p>
              {data?.meta ? (
                <dl className="mt-5 grid grid-cols-3 gap-3">
                  <div>
                    <dt className="text-[12px] text-theme-muted">Spend</dt>
                    <dd className="mt-1 text-[22px] font-bold text-theme-fg">{money(data.meta.spend, data.meta.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-[12px] text-theme-muted">Leads</dt>
                    <dd className="mt-1 text-[22px] font-bold text-theme-fg">{data.meta.metaLeads}</dd>
                  </div>
                  <div>
                    <dt className="text-[12px] text-theme-muted">Cost per lead</dt>
                    <dd className="mt-1 text-[22px] font-bold text-theme-fg">{money(data.meta.cpl, data.meta.currency)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-5 text-[13px] leading-relaxed text-theme-muted">
                  No snapshot yet. Connect a Page and share an ad account on Facebook → Ads.
                </p>
              )}
            </section>

            <section className="dashboard-card border-t-[3px] border-t-whatsapp-500 p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-whatsapp-600 dark:text-whatsapp-400">Yours</p>
              <h2 className="mt-1 text-[18px] font-bold text-theme-fg">Won leads</h2>
              <p className="mt-1 text-[12px] text-theme-muted">These dates and the source filter apply only here.</p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-[12px] font-semibold text-theme-muted">
                  From
                  <input
                    type="date"
                    className="mt-1 block rounded-xl border border-theme-border bg-theme-surface px-3 py-2 text-[13px] text-theme-fg"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                  />
                </label>
                <label className="text-[12px] font-semibold text-theme-muted">
                  To
                  <input
                    type="date"
                    className="mt-1 block rounded-xl border border-theme-border bg-theme-surface px-3 py-2 text-[13px] text-theme-fg"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                  />
                </label>
                <label className="text-[12px] font-semibold text-theme-muted">
                  Source
                  <select
                    className="mt-1 block rounded-xl border border-theme-border bg-theme-surface px-3 py-2 text-[13px] text-theme-fg"
                    value={platform}
                    onChange={(event) => setPlatform(event.target.value)}
                  >
                    {platforms.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-3 text-[12px] text-theme-muted">Instant Form leads you marked qualified or won. A blank amount stays blank.</p>
              {data?.pipeline.note ? <p className="mt-3 text-[13px] text-theme-fg">{data.pipeline.note}</p> : null}
              <dl className="mt-5 grid grid-cols-3 gap-3">
                <div>
                  <dt className="text-[12px] text-theme-muted">Qualified</dt>
                  <dd className="mt-1 text-[22px] font-bold text-theme-fg">{data?.pipeline.qualified ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-theme-muted">Won</dt>
                  <dd className="mt-1 text-[22px] font-bold text-theme-fg">{data?.pipeline.won ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-theme-muted">Entered revenue</dt>
                  <dd className="mt-1 text-[22px] font-bold text-theme-fg">{money(data?.pipeline.revenue ?? null, currency)}</dd>
                </div>
              </dl>
              <ul className="mt-4 divide-y divide-theme-border">
                {(data?.pipeline.wonLeads || []).length === 0 ? (
                  <li className="py-3 text-[13px] text-theme-muted">No won leads in this range.</li>
                ) : (
                  data?.pipeline.wonLeads.map((lead) => (
                    <li key={lead.id} className="flex flex-wrap items-center gap-2 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-theme-fg">{lead.title}</span>
                      <input
                        aria-label={`Amount for ${lead.title}`}
                        className="w-28 rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-[13px] text-theme-fg"
                        placeholder="Amount"
                        defaultValue={lead.amount ?? ''}
                        onChange={(event) => setDrafts((current) => ({ ...current, [lead.id]: event.target.value }))}
                      />
                      <AppButton size="sm" variant="secondary" onClick={() => saveAmount(lead.id, lead.amount)}>
                        Save
                      </AppButton>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        )}
      </div>
    </PageShell>
  );
}
