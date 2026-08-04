import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Calendar,
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

/** DEV-only sample rows so the list UI can be reviewed when the org has no campaigns. */
function buildMockCampaigns(): Campaign[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    {
      id: 'mock-camp-1',
      name: 'Summer Sale Blast',
      templateName: 'summer_sale',
      status: 'SCHEDULED',
      totalContacts: 1240,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      scheduledAt: new Date(now + 3 * day).toISOString(),
    },
    {
      id: 'mock-camp-2',
      name: 'Festive Offer Reminder',
      templateName: 'festive_offer',
      status: 'SCHEDULED',
      totalContacts: 860,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      scheduledAt: new Date(now + 7 * day).toISOString(),
    },
    {
      id: 'mock-camp-3',
      name: 'Cart Abandonment Follow-up',
      templateName: 'cart_recovery',
      status: 'DRAFT',
      totalContacts: 312,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      createdAt: new Date(now - 2 * day).toISOString(),
    },
  ];
}

export default function UpcomingCampaignsCard({
  campaigns,
  loading,
  error,
  onRetry,
}: UpcomingCampaignsCardProps) {
  const displayCampaigns =
    !loading && !error && campaigns.length === 0 && import.meta.env.DEV
      ? buildMockCampaigns()
      : campaigns;
  const showingMock = displayCampaigns !== campaigns && displayCampaigns.length > 0;

  return (
    <section className="dashboard-card flex h-full flex-col rounded-2xl border border-neutral-100/90 bg-white p-3 shadow-xs sm:rounded-3xl sm:p-3.5">
      {/* Card Header: Icon + Title + Info + View All Link */}
      <div className="flex shrink-0 items-start justify-between gap-2 sm:items-center sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <IconWell accent="emerald" size="sm" round>
            <Megaphone className="h-4 w-4 stroke-[2.2]" />
          </IconWell>
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-[14px] font-bold tracking-tight text-neutral-900 sm:text-[15px] md:text-[16px]">
              Upcoming campaigns
            </h2>
            <Info className="hidden h-4 w-4 shrink-0 stroke-[1.8] text-neutral-400 sm:block" />
            {showingMock ? (
              <span className="hidden rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100 sm:inline">
                Preview
              </span>
            ) : null}
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
              className="min-h-[3.75rem] animate-pulse rounded-xl border border-neutral-100/80 bg-neutral-50/90 sm:min-h-[4rem]"
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
      ) : displayCampaigns.length === 0 ? (
        <div className="mt-2.5 flex min-h-0 flex-1 flex-col justify-center">
          <div className="flex flex-col rounded-xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/70 via-teal-50/30 to-sky-50/40 p-3 sm:p-3.5">
            <div className="flex items-start gap-3">
              <IconWell accent="emerald" size="lg" className="shrink-0 shadow-xs">
                <Megaphone className="h-5 w-5 stroke-[2]" />
              </IconWell>
              <div className="min-w-0">
                <h3 className="text-[14px] font-extrabold tracking-tight text-neutral-900">
                  Launch your first campaign
                </h3>
                <p className="mt-1 text-[12px] font-medium leading-relaxed text-neutral-600">
                  Broadcast WhatsApp messages to your contacts with delivery and read tracking.
                </p>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-emerald-100/60 pt-2 text-[11px] font-semibold text-neutral-700">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span>Delivery tracking</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                <span>Smart scheduling</span>
              </div>
            </div>

            <div className="mt-3 pt-0.5">
              <Link
                to="/campaigns"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-whatsapp-600 px-3.5 py-1.5 text-[12px] font-bold text-white shadow-md shadow-whatsapp-600/20 transition hover:bg-whatsapp-700"
              >
                Create Campaign
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <ul className="mt-2.5 flex min-h-0 flex-1 flex-col justify-center gap-2 sm:gap-2.5">
          {displayCampaigns.slice(0, 3).map((c, idx) => {
            const visual = getCampaignVisual(c, idx);
            const Icon = visual.icon;
            const isScheduled = c.status === 'SCHEDULED';
            const formattedDate = formatScheduleDate(c.scheduledAt);
            const recipientCount = (c.totalContacts || 0).toLocaleString();

            return (
              <li key={c.id}>
                <Link
                  to="/campaigns"
                  className="group flex min-h-[3.75rem] items-center justify-between gap-3 rounded-xl border border-neutral-100/90 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-neutral-200/90 hover:bg-neutral-50/50 sm:min-h-[4rem] sm:gap-3 sm:px-3.5 sm:py-3"
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
