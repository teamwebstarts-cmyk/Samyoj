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

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-[18px] font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-[13px] text-theme-muted">
          Meta ads and your won leads stay in two columns. There is no combined ROI.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-[12px] font-bold text-neutral-700">
            From
            <input
              type="date"
              className="mt-1 block rounded-xl border border-neutral-200 px-3 py-2 text-[13px]"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="text-[12px] font-bold text-neutral-700">
            To
            <input
              type="date"
              className="mt-1 block rounded-xl border border-neutral-200 px-3 py-2 text-[13px]"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <label className="text-[12px] font-bold text-neutral-700">
            Platform
            <select
              className="mt-1 block rounded-xl border border-neutral-200 px-3 py-2 text-[13px]"
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
        {loading ? (
          <div className="flex justify-center py-16 text-theme-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-neutral-100 bg-white p-5">
              <h2 className="text-[15px] font-bold">Meta ads</h2>
              <p className="mt-1 text-[12px] font-semibold text-[#1877F2]">
                {data?.meta?.periodLabel || 'Last 7 days'} · {data?.meta?.attributionLabel || '7-day click / 1-day view'}
              </p>
              {data?.meta ? (
                <dl className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <dt className="text-[10px] font-extrabold uppercase text-neutral-500">Spend</dt>
                    <dd className="mt-1 text-[20px] font-extrabold">{money(data.meta.spend, data.meta.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-extrabold uppercase text-neutral-500">Meta leads</dt>
                    <dd className="mt-1 text-[20px] font-extrabold">{data.meta.metaLeads}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-extrabold uppercase text-neutral-500">CPL</dt>
                    <dd className="mt-1 text-[20px] font-extrabold">{money(data.meta.cpl, data.meta.currency)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-4 text-[13px] text-neutral-600">
                  No Ads snapshot yet. Connect a Page and share an ad account on Facebook → Ads.
                </p>
              )}
              <p className="mt-3 text-[12px] text-theme-muted">This column is Meta’s snapshot. Date filters change only your pipeline.</p>
            </section>
            <section className="rounded-2xl border border-neutral-100 bg-white p-5">
              <h2 className="text-[15px] font-bold">Your pipeline</h2>
              <p className="mt-1 text-[12px] text-neutral-600">Qualified and won Instant Form leads. Revenue is the sum you enter on Won.</p>
              {data?.pipeline.note ? <p className="mt-3 text-[13px] text-neutral-700">{data.pipeline.note}</p> : null}
              <dl className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <dt className="text-[10px] font-extrabold uppercase text-neutral-500">Qualified</dt>
                  <dd className="mt-1 text-[20px] font-extrabold">{data?.pipeline.qualified ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-extrabold uppercase text-neutral-500">Won</dt>
                  <dd className="mt-1 text-[20px] font-extrabold">{data?.pipeline.won ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-extrabold uppercase text-neutral-500">Revenue</dt>
                  <dd className="mt-1 text-[20px] font-extrabold">{data?.pipeline.revenue ?? '—'}</dd>
                </div>
              </dl>
              <ul className="mt-4 space-y-2">
                {(data?.pipeline.wonLeads || []).map((lead) => (
                  <li key={lead.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{lead.title}</span>
                    <input
                      aria-label={`Amount for ${lead.title}`}
                      className="w-28 rounded-lg border border-neutral-200 px-2 py-1 text-[13px]"
                      placeholder="Amount"
                      defaultValue={lead.amount ?? ''}
                      onChange={(event) => setDrafts((current) => ({ ...current, [lead.id]: event.target.value }))}
                    />
                    <AppButton size="sm" variant="secondary" onClick={() => saveAmount(lead.id, lead.amount)}>
                      Save
                    </AppButton>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </PageShell>
  );
}
