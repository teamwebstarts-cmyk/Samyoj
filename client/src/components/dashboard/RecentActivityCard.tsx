import { Link } from 'react-router-dom';
import { ArrowRight, Bot, CheckCircle2, MessageSquare, Send, UserRound, Zap } from 'lucide-react';
import IconWell, { type IconWellAccent } from './icons/IconWell';
import WhatsAppGlyph from './icons/WhatsAppGlyph';
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

const TYPE_META: Record<ActivityType, { accent: IconWellAccent; round?: boolean; icon: ReactNode }> = {
  message: {
    accent: 'whatsapp',
    round: true,
    icon: <WhatsAppGlyph className="h-3.5 w-3.5" />,
  },
  campaign: {
    accent: 'sky',
    icon: <Send className="h-3.5 w-3.5" strokeWidth={2.2} />,
  },
  template: {
    accent: 'emerald',
    icon: <CheckCircle2 className="h-4 w-4 stroke-[2.2]" />,
  },
  automation: {
    accent: 'amber',
    icon: <Zap className="h-3.5 w-3.5 stroke-[2.2]" />,
  },
  ai: {
    accent: 'sky',
    icon: <Bot className="h-4 w-4 stroke-[2]" />,
  },
  agent: {
    accent: 'slate',
    icon: <UserRound className="h-3.5 w-3.5 stroke-[2]" />,
  },
};

function itemDividerClass(index: number): string {
  // Mobile: horizontal rules between stacked rows
  // sm 2-col: left rule on odd cells + top rule on second row
  // xl 4-col: left rule on every cell after the first
  return [
    index > 0 ? 'border-t border-neutral-100/90' : '',
    'sm:border-t-0',
    index >= 2 ? 'sm:border-t sm:border-neutral-100/90' : '',
    'xl:border-t-0',
    index % 2 === 1 ? 'sm:border-l sm:border-neutral-100/90' : '',
    index > 0 ? 'xl:border-l xl:border-neutral-100/90' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export default function RecentActivityCard({
  items = [],
  loading = false,
  error = false,
  onRetry,
}: RecentActivityCardProps) {
  const visible = items.slice(0, 4);

  return (
    <section className="dashboard-card flex h-auto flex-col rounded-2xl border border-neutral-100/90 bg-white p-3.5 shadow-xs sm:rounded-3xl sm:p-4 md:p-5">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <h2 className="text-[14px] font-bold tracking-tight text-neutral-900 sm:text-[15px] md:text-[16px]">
          Recent activity
        </h2>
        <Link
          to="/inbox"
          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline sm:text-[12.5px]"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 py-3.5 sm:px-4 sm:py-2.5 ${itemDividerClass(i)} ${
                i === 0 ? 'sm:pl-0' : ''
              } ${i === 3 ? 'xl:pr-0' : ''}`}
            >
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-neutral-100" />
              <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                <div className="h-3 w-[85%] animate-pulse rounded bg-neutral-100" />
                <div className="h-2.5 w-[65%] animate-pulse rounded bg-neutral-100" />
                <div className="h-2.5 w-16 animate-pulse rounded bg-neutral-100" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-3.5 flex flex-col items-start justify-center py-2">
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
      ) : visible.length === 0 ? (
        <div className="mt-3.5 flex flex-col items-center justify-center px-2 py-6 text-center sm:py-7">
          <IconWell accent="emerald" size="md" round>
            <MessageSquare className="h-4 w-4" strokeWidth={2} />
          </IconWell>
          <p className="mt-3 text-[13px] font-bold text-neutral-900 sm:text-[13.5px]">
            No recent activity yet
          </p>
          <p className="mt-1 max-w-[280px] text-[11.5px] font-medium text-neutral-500 sm:text-[12px]">
            Customer messages, campaigns, automations, and AI replies will show up here.
          </p>
          <Link
            to="/inbox"
            className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold text-emerald-600 hover:underline"
          >
            Open inbox
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {visible.map((item, index) => {
            const meta = TYPE_META[item.type] || TYPE_META.message;
            const when = formatTimeAgo(item.createdAt, item.timeAgo);
            const isFirst = index === 0;
            const isLast = index === visible.length - 1;

            return (
              <Link
                key={item.id}
                to={item.href}
                className={[
                  'group flex min-w-0 items-start gap-3 py-3.5 transition-colors sm:px-4 sm:py-2.5',
                  itemDividerClass(index),
                  isFirst ? 'sm:pl-0' : '',
                  isLast ? 'xl:pr-0' : '',
                ].join(' ')}
              >
                <IconWell
                  accent={meta.accent}
                  size="sm"
                  round={meta.round}
                  className="mt-0.5 shrink-0"
                >
                  {meta.icon}
                </IconWell>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold leading-snug text-neutral-900 transition-colors group-hover:text-emerald-700 sm:text-[13.5px]">
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] font-medium text-neutral-500">
                    {item.subtitle}
                  </p>
                  {when ? (
                    <p className="mt-1 text-[11.5px] font-medium tabular-nums text-neutral-400">
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
