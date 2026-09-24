import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { facebookApi } from '../../services/api';

type Snap = NonNullable<Awaited<ReturnType<typeof facebookApi.adsSummary>>['data']['data']['snapshot']>;

function formatMoney(amount: string, currency: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${amount}`;
  }
}

/** Same /facebook/ads-summary payload as Facebook → Ads. Hidden until a real snapshot exists. */
export default function MetaAdsRecap() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [label, setLabel] = useState('');

  useEffect(() => {
    let cancelled = false;
    facebookApi
      .adsSummary()
      .then((res) => {
        if (cancelled) return;
        const body = res.data.data;
        if (body.status === 'ready' && body.snapshot) {
          setSnap(body.snapshot);
          setLabel(`${body.periodLabel} · ${body.attributionLabel}`);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!snap) return null;

  const cpl = snap.cpl ? formatMoney(snap.cpl, snap.currency) : '—';
  return (
    <div className="dashboard-card flex flex-col gap-1 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[13px] font-semibold text-neutral-900">
        Meta ads · {formatMoney(snap.spend, snap.currency)} spend · {snap.leads} leads · CPL {cpl}
      </p>
      <p className="text-[12px] text-neutral-500">
        Meta's numbers. Not Samyoj revenue. {label}{' '}
        <Link to="/facebook/ads" className="font-semibold text-[#1877F2]">
          View
        </Link>
      </p>
    </div>
  );
}
