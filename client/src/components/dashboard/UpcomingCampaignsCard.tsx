import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Calendar,
  CalendarCheck,
  Clock,
  Gift,
  Info,
  Megaphone,
  Send,
  ShoppingCart,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Campaign } from '../../types';
import IconWell, { type IconWellAccent } from './icons/IconWell';

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
    <section className="dashboard-card flex h-auto flex-col justify-between rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 md:p-5 lg:p-6 bg-white border border-neutral-100/90 shadow-xs">
      {/* Card Header: Icon + Title + Info + View All Link */}
      <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <IconWell accent="emerald" size="sm" round>
            <CalendarCheck className="h-4 w-4 stroke-[2.2]" />
          </IconWell>
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-[14px] sm:text-[15px] md:text-[16px] font-bold text-neutral-900 tracking-tight">
              Upcoming campaigns
            </h2>
            <Info className="hidden h-4 w-4 shrink-0 text-neutral-400 stroke-[1.8] sm:block" />
          </div>
        </div>
        <Link
          to="/campaigns"
          className="inline-flex shrink-0 items-center gap-1 text-[12px] sm:text-[12.5px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="my-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-neutral-100/80" />
          ))}
        </div>
      ) : error ? (
        <div className="my-4 flex flex-col items-center text-center justify-center rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 px-4 py-6">
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
              className="mt-3 inline-flex rounded-xl border border-amber-200/80 bg-white px-3.5 py-1.5 text-[12px] font-bold text-amber-900 shadow-xs hover:bg-amber-50 transition"
            >
              Retry
            </button>
          )}
        </div>
      ) : campaigns.length === 0 ? (
        /* Rich Engaging Empty State for First-Time / Blank Screen */
        <div className="my-3 flex flex-col justify-between rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/70 via-teal-50/30 to-sky-50/40 p-4 sm:p-5">
          <div className="flex items-start gap-3.5">
            <IconWell accent="emerald" size="lg" className="shadow-xs shrink-0">
              <Megaphone className="h-5 w-5 stroke-[2]" />
            </IconWell>
            <div className="min-w-0">
              <h3 className="text-[14px] font-extrabold text-neutral-900 tracking-tight">
                Launch your first campaign
              </h3>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-neutral-600">
                Broadcast targeted WhatsApp messages to thousands of customers at once with high open rates.
              </p>
            </div>
          </div>

          {/* Key Campaign Benefits */}
          <div className="mt-3.5 grid grid-cols-2 gap-2 pt-2 border-t border-emerald-100/60 text-[11.5px] font-semibold text-neutral-700">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Up to 98% open rate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-sky-600 shrink-0" />
              <span>Smart scheduling</span>
            </div>
          </div>

          <div className="mt-4 pt-1">
            <Link
              to="/campaigns"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-whatsapp-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-md shadow-whatsapp-600/20 transition hover:bg-whatsapp-700"
            >
              Create Campaign
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        /* Campaign List Rows (Matches image-006bf22f-203b-45df-8b74-768e9c32ebb4.png exactly) */
        <ul className="my-2 space-y-1 divide-y divide-neutral-100/80">
          {campaigns.slice(0, 3).map((c, idx) => {
            const visual = getCampaignVisual(c, idx);
            const Icon = visual.icon;
            const isScheduled = c.status === 'SCHEDULED';
            const formattedDate = formatScheduleDate(c.scheduledAt);
            const recipientCount = (c.totalContacts || 0).toLocaleString();

            return (
              <li key={c.id} className="pt-2.5 first:pt-0 pb-2.5 last:pb-0">
                <Link
                  to="/campaigns"
                  className="group flex items-center justify-between gap-3 rounded-xl p-1.5 -mx-1.5 transition hover:bg-neutral-50/80"
                >
                  {/* Left Column: Icon Well + Title & Subtitle */}
                  <div className="flex min-w-0 items-center gap-3">
                    <IconWell accent={visual.accent} size="md" className="shrink-0">
                      <Icon className="h-4 w-4 stroke-[2]" />
                    </IconWell>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="truncate text-[13.5px] font-bold text-neutral-900 group-hover:text-emerald-700 transition-colors">
                          {c.name}
                        </span>
                        {/* Status Chip Inline */}
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            isScheduled
                              ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300'
                              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}
                        >
                          {isScheduled ? 'Scheduled' : 'Draft'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11.5px] font-medium text-neutral-500">
                        {visual.categoryLabel} · {recipientCount} recipients
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Date + Icon */}
                  <div className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-neutral-500">
                    <span>{formattedDate}</span>
                    {isScheduled ? (
                      <Calendar className="h-3.5 w-3.5 text-neutral-400 stroke-[1.8]" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-neutral-400 stroke-[1.8]" />
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
