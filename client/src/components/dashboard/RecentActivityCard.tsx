import { Link } from 'react-router-dom';
import { ArrowRight, Bot, CheckCircle2, Clock, Send, UserRound, Zap } from 'lucide-react';
import IconWell, { type IconWellAccent } from './icons/IconWell';
import WhatsAppGlyph from './icons/WhatsAppGlyph';
import { ActivityEmptyIllustrationSvg } from './icons/CardIllustrations';
import type { ReactNode } from 'react';

export type ActivityType = 'message' | 'campaign' | 'template' | 'automation' | 'ai' | 'agent';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  subtitle: string;
  timeAgo?: string;
  createdAt?: string;
  href: string;
}

interface RecentActivityCardProps {
  items?: ActivityItem[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

function formatTimeAgo(iso?: string, fallback?: string): string {
  if (fallback) return fallback;
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 45) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    return h === 1 ? '1 hour ago' : `${h} hours ago`;
  }
  const d = Math.floor(sec / 86400);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

const TYPE_META: Record<
  ActivityType,
  { accent: IconWellAccent; icon: ReactNode }
> = {
  message: {
    accent: 'whatsapp',
    icon: <WhatsAppGlyph className="h-3.5 w-3.5" />,
  },
  campaign: {
    accent: 'violet',
    icon: <Send className="h-3.5 w-3.5" strokeWidth={2.2} />,
  },
  template: {
    accent: 'emerald',
    icon: <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.2]" />,
  },
  automation: {
    accent: 'amber',
    icon: <Zap className="h-3.5 w-3.5 stroke-[2.2]" />,
  },
  ai: {
    accent: 'sky',
    icon: <Bot className="h-3.5 w-3.5 stroke-[2]" />,
  },
  agent: {
    accent: 'slate',
    icon: <UserRound className="h-3.5 w-3.5 stroke-[2]" />,
  },
};

export default function RecentActivityCard({
  items = [],
  loading = false,
  error = false,
  onRetry,
}: RecentActivityCardProps) {
  const visible = items.slice(0, 4);
  const isEmpty = !loading && !error && visible.length === 0;

  return (
    <section className="dashboard-card flex h-full flex-col rounded-2xl border border-neutral-100/90 bg-white p-3 shadow-xs sm:rounded-3xl sm:p-3.5">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <IconWell accent="slate" size="sm">
            <Clock className="h-4 w-4 stroke-[2.2]" />
          </IconWell>
          <h2 className="text-[14px] font-bold tracking-tight text-neutral-900 sm:text-[15px]">
            Recent activity
          </h2>
        </div>
        {!isEmpty && !loading && !error ? (
          <Link
            to="/inbox"
            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline sm:text-[12.5px]"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex min-w-0 items-start gap-2.5">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-neutral-100" />
              <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                <div className="h-3 w-[90%] animate-pulse rounded bg-neutral-100" />
                <div className="h-2.5 w-[70%] animate-pulse rounded bg-neutral-100" />
                <div className="h-2.5 w-14 animate-pulse rounded bg-neutral-100" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-3 flex min-h-0 flex-1 flex-col items-start justify-center">
          <p className="text-[13px] font-bold text-neutral-900">Couldn&apos;t load activity</p>
          <p className="mt-0.5 text-[12px] text-neutral-600">
            Recent updates are temporarily unavailable.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-1.5 text-[12px] font-bold text-amber-900 hover:bg-amber-50"
            >
              Retry
            </button>
          )}
        </div>
      ) : isEmpty ? (
        <div className="mt-3 flex min-h-0 flex-1 flex-col items-center justify-center px-2 text-center">
          <ActivityEmptyIllustrationSvg className="h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20" />
          <p className="mt-2 text-[13px] font-bold text-neutral-900 sm:text-[13.5px]">
            No activity yet
          </p>
          <p className="mt-1 max-w-[240px] text-[12px] font-medium text-neutral-500">
            Your recent activity will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 content-center gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-2.5">
          {visible.map((item) => {
            const meta = TYPE_META[item.type] || TYPE_META.message;
            const when = formatTimeAgo(item.createdAt, item.timeAgo);

            return (
              <Link
                key={item.id}
                to={item.href}
                className="group flex min-w-0 items-start gap-2.5 rounded-xl p-1 transition hover:bg-neutral-50/80"
              >
                <IconWell accent={meta.accent} size="sm" className="mt-0.5 shrink-0">
                  {meta.icon}
                </IconWell>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[12.5px] font-bold leading-snug text-neutral-900 transition-colors group-hover:text-emerald-700 sm:text-[13px]">
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-neutral-500">
                    {item.subtitle}
                  </p>
                  {when ? (
                    <p className="mt-1 text-[11px] font-medium tabular-nums text-neutral-400">
                      {when}
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
