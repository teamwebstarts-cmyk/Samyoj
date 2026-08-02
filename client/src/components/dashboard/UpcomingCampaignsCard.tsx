import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, Clock3, Gift, Send, ShoppingCart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Campaign } from '../../types';
import IconWell, { type IconWellAccent } from './icons/IconWell';

interface UpcomingCampaignsCardProps {
  campaigns: Campaign[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

const ROW_ACCENTS: Array<{ accent: IconWellAccent; icon: LucideIcon }> = [
  { accent: 'emerald', icon: Send },
  { accent: 'sky', icon: Gift },
  { accent: 'violet', icon: ShoppingCart },
];

function formatWhen(iso?: string) {
  if (!iso) return 'Not scheduled';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not scheduled';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusChip(status: string) {
  if (status === 'SCHEDULED') return 'bg-sky-50 text-sky-700';
  if (status === 'DRAFT') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-50 text-amber-800';
}

export default function UpcomingCampaignsCard({
  campaigns,
  loading,
  error,
  onRetry,
}: UpcomingCampaignsCardProps) {
  return (
    <section className="dashboard-card flex h-full flex-col rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-extrabold tracking-tight text-neutral-900 sm:text-[15px]">
            Upcoming campaigns
          </h2>
          <p className="mt-0.5 text-[12px] font-medium text-neutral-500">Scheduled & drafts</p>
        </div>
        <Link
          to="/campaigns"
          className="inline-flex items-center gap-0.5 text-[12px] font-bold text-whatsapp-700 hover:underline"
        >
          View all
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-neutral-100" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-4 flex flex-1 flex-col items-start justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-6">
          <IconWell accent="amber" size="md">
            <Send className="h-4 w-4" strokeWidth={2} />
          </IconWell>
          <p className="mt-2 text-[13px] font-bold text-neutral-800">Couldn&apos;t load campaigns</p>
          <p className="mt-0.5 text-[12px] text-neutral-500">Check your connection, then try again.</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[12px] font-bold text-amber-900 hover:bg-amber-50"
            >
              Retry
            </button>
          )}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="mt-4 flex flex-1 flex-col items-start justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 px-4 py-6">
          <IconWell accent="violet" size="md">
            <Send className="h-4 w-4" strokeWidth={2} />
          </IconWell>
          <p className="mt-2 text-[13px] font-bold text-neutral-800">No campaigns scheduled</p>
          <p className="mt-0.5 text-[12px] text-neutral-500">Create one to reach many contacts at once.</p>
          <Link
            to="/campaigns"
            className="mt-3 inline-flex rounded-lg bg-whatsapp-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-whatsapp-700"
          >
            Create campaign
          </Link>
        </div>
      ) : (
        <ul className="mt-3 flex-1 space-y-2">
          {campaigns.slice(0, 3).map((c, idx) => {
            const visual = ROW_ACCENTS[idx % ROW_ACCENTS.length];
            const Icon = visual.icon;
            const WhenIcon = c.status === 'SCHEDULED' && c.scheduledAt ? CalendarClock : Clock3;
            return (
              <li key={c.id}>
                <Link
                  to="/campaigns"
                  className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50/70 px-3 py-2.5 transition hover:border-emerald-100 hover:bg-emerald-50/40"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IconWell accent={visual.accent} size="sm" round>
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </IconWell>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-neutral-900">{c.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-neutral-500">
                        <WhenIcon className="h-3 w-3 shrink-0" strokeWidth={2} />
                        {formatWhen(c.scheduledAt)}
                        <span className="text-neutral-300">·</span>
                        {(c.totalContacts || 0).toLocaleString()} recipients
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusChip(
                      c.status
                    )}`}
                  >
                    {c.status === 'SCHEDULED' ? 'Scheduled' : c.status === 'DRAFT' ? 'Draft' : c.status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
