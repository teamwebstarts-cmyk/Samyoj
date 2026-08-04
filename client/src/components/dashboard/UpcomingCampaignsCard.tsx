import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Calendar,
  Clock,
  Gift,
  Info,
  Megaphone,
  Plus,
  Send,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Campaign } from '../../types';
import IconWell, { type IconWellAccent } from './icons/IconWell';
import { CampaignEmptyIllustrationSvg } from './icons/CardIllustrations';

interface UpcomingCampaignsCardProps {
  campaigns: Campaign[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

interface CampaignVisual {
  accent: IconWellAccent;
  icon: LucideIcon;
  categoryLabel: string;
}

const VISUAL_ROTATION: CampaignVisual[] = [
  { accent: 'emerald', icon: Send, categoryLabel: 'Broadcast' },
  { accent: 'sky', icon: Gift, categoryLabel: 'Offer Broadcast' },
  { accent: 'violet', icon: ShoppingCart, categoryLabel: 'Automation · Cart Recovery' },
  { accent: 'amber', icon: Sparkles, categoryLabel: 'Automation · Follow-up' },
];

/**
 * Smartly selects icon, color theme accent, and category label based on campaign properties
 */
function getCampaignVisual(campaign: Campaign, index: number): CampaignVisual {
  const name = (campaign.name || '').toLowerCase();
  const templateName = (campaign.templateName || '').toLowerCase();
  const audience = (campaign.audienceType || '').toLowerCase();

  if (
    name.includes('launch') ||
    name.includes('summer') ||
    name.includes('collection') ||
    templateName.includes('launch') ||
    audience.includes('all')
  ) {
    return { accent: 'emerald', icon: Send, categoryLabel: 'Broadcast' };
  }
  if (
    name.includes('offer') ||
    name.includes('festive') ||
    name.includes('gift') ||
    name.includes('sale') ||
    name.includes('promo') ||
    name.includes('discount')
  ) {
    return { accent: 'sky', icon: Gift, categoryLabel: 'Broadcast' };
  }
  if (
    name.includes('cart') ||
    name.includes('abandoned') ||
    name.includes('shop') ||
    name.includes('recovery') ||
    name.includes('order')
  ) {
    return { accent: 'violet', icon: ShoppingCart, categoryLabel: 'Automation · Cart Recovery' };
  }
  if (
    name.includes('reminder') ||
    name.includes('follow') ||
    name.includes('welcome') ||
    name.includes('vip') ||
    name.includes('alert')
  ) {
    return { accent: 'amber', icon: Bell, categoryLabel: 'Automation' };
  }

  return VISUAL_ROTATION[index % VISUAL_ROTATION.length];
}

function formatScheduleDate(iso?: string) {
  if (!iso) return 'Not scheduled';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not scheduled';

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today, ${timeStr}`;
  if (isTomorrow) return `Tomorrow, ${timeStr}`;

  const dateStr = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `${dateStr}, ${timeStr}`;
}

export default function UpcomingCampaignsCard({
  campaigns,
  loading,
  error,
  onRetry,
}: UpcomingCampaignsCardProps) {
  return (
    <section className="dashboard-card flex h-full flex-col rounded-2xl border border-neutral-100/90 bg-white p-3 shadow-xs sm:rounded-3xl sm:p-3.5">
      {/* Card Header: Icon + Title + Info + View All Link */}
      <div className="flex shrink-0 items-start justify-between gap-2 sm:items-center sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <IconWell accent="emerald" size="sm">
            <Megaphone className="h-4 w-4 stroke-[2.2]" />
          </IconWell>
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="truncate text-[14px] font-bold tracking-tight text-neutral-900 sm:text-[15px] md:text-[16px]">
              Upcoming campaigns
            </h2>
            <Info className="hidden h-4 w-4 shrink-0 stroke-[1.8] text-neutral-400 sm:block" />
          </div>
        </div>
        <Link
          to="/campaigns"
          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline sm:text-[12.5px]"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="mt-2.5 flex flex-1 flex-col justify-center gap-2 sm:gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[4.5rem] animate-pulse rounded-xl border border-neutral-100/80 bg-neutral-50/90 sm:min-h-[4.75rem]"
            />
          ))}
        </div>
      ) : error ? (
        <div className="my-4 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 px-4 py-6 text-center">
          <IconWell accent="amber" size="md">
            <Send className="h-4 w-4" strokeWidth={2} />
          </IconWell>
          <p className="mt-2.5 text-[13.5px] font-bold text-neutral-800">
            Couldn&apos;t load campaigns
          </p>
          <p className="mt-0.5 text-[12px] text-neutral-500">
            Check your connection, then try again.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex rounded-xl border border-amber-200/80 bg-white px-3.5 py-1.5 text-[12px] font-bold text-amber-900 shadow-xs transition hover:bg-amber-50"
            >
              Retry
            </button>
          )}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="mt-2.5 flex min-h-0 flex-1 flex-col items-center justify-center px-2 text-center">
          <CampaignEmptyIllustrationSvg className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]" />
          <h3 className="mt-2 text-[13px] font-bold tracking-tight text-neutral-900 sm:text-[13.5px]">
            No campaigns yet
          </h3>
          <p className="mt-0.5 max-w-[220px] text-[11.5px] font-medium leading-snug text-neutral-500">
            Create your first campaign to reach your audience.
          </p>
          <Link
            to="/campaigns"
            className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-whatsapp-500 px-3.5 py-2 text-[12.5px] font-bold tracking-tight text-white shadow-[0_4px_14px_rgba(37,211,102,0.3)] transition duration-200 hover:bg-[#1ebe57] active:scale-[0.98]"
          >
            Create Campaign
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          </Link>
        </div>
      ) : (
        <ul className="mt-2.5 flex min-h-0 flex-1 flex-col justify-center gap-2 sm:gap-2.5">
          {campaigns.slice(0, 3).map((c, idx) => {
            const visual = getCampaignVisual(c, idx);
            const Icon = visual.icon;
            const isScheduled = c.status === 'SCHEDULED';
            const formattedDate = formatScheduleDate(c.scheduledAt);
            const recipientCount = (c.totalContacts || 0).toLocaleString();

            return (
              <li key={c.id}>
                <Link
                  to="/campaigns"
                  className="group flex min-h-[4.5rem] items-center justify-between gap-3 rounded-xl border border-neutral-100/90 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-neutral-200/90 hover:bg-neutral-50/50 sm:min-h-[4.75rem] sm:gap-3 sm:px-3.5 sm:py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                    <IconWell accent={visual.accent} size="md" className="shrink-0">
                      <Icon className="h-4 w-4 stroke-[2]" />
                    </IconWell>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[13px] font-bold leading-snug text-neutral-900 transition-colors group-hover:text-emerald-700 sm:text-[13.5px]">
                          {c.name}
                        </span>
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold sm:px-2 sm:text-[11px] ${
                            isScheduled
                              ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300'
                              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}
                        >
                          {isScheduled ? 'Scheduled' : 'Draft'}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] font-medium leading-snug text-neutral-500 sm:text-[11.5px]">
                        {visual.categoryLabel} · {recipientCount} recipients
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-medium text-neutral-500 sm:text-[12px]">
                    <span className="tabular-nums">{formattedDate}</span>
                    {isScheduled ? (
                      <Calendar className="h-3.5 w-3.5 stroke-[1.8] text-neutral-400" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 stroke-[1.8] text-neutral-400" />
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
