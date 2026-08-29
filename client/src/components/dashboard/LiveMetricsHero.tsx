import type { ReactNode } from 'react';
import MetricsPeriodPicker from './MetricsPeriodPicker';
import type { MetricsPeriod } from '../../utils/metricsPeriod';
import { formatMessagingLimitTier } from '../../utils/messagingLimitTier';
import InfoTip from '../ui/InfoTip';

export {
  METRICS_PRESET_OPTIONS as LIVE_METRICS_PERIOD_OPTIONS,
  type MetricsPresetDays as LiveMetricsPeriodDays,
} from '../../utils/metricsPeriod';
export type { MetricsPeriod } from '../../utils/metricsPeriod';

export type PhoneQualityRating = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN' | string;

interface LiveMetricsHeroProps {
  messagesSent: number;
  qualityRating?: string | null;
  messagingLimitTier?: string | null;
  period: MetricsPeriod;
  onPeriodChange?: (period: MetricsPeriod) => void;
}

function qualityCopy(rating: string | null | undefined): {
  label: 'High' | 'Medium' | 'Low' | 'Unknown';
  chip: string;
} {
  const value = String(rating || 'UNKNOWN').toUpperCase();
  if (value === 'GREEN') {
    return { label: 'High', chip: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80' };
  }
  if (value === 'YELLOW') {
    return { label: 'Medium', chip: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80' };
  }
  if (value === 'RED') {
    return { label: 'Low', chip: 'bg-rose-50 text-rose-800 ring-1 ring-rose-200/80' };
  }
  return { label: 'Unknown', chip: 'bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200/80' };
}

function MiniCard({
  label,
  children,
  tip,
  tipLabel,
}: {
  label: string;
  children: ReactNode;
  tip: ReactNode;
  tipLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center rounded-xl border border-neutral-100/90 bg-white px-2 py-2.5 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:rounded-2xl sm:px-3 sm:py-3">
      <p className="flex items-center justify-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-neutral-500 sm:text-[10px]">
        <span>{label}</span>
        <InfoTip content={tip} label={tipLabel} />
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function LimitTip({ cap, known, unlimited }: { cap: string; known: boolean; unlimited: boolean }) {
  return (
    <div className="space-y-2 font-medium text-neutral-950">
      <p className="font-extrabold">
        {unlimited
          ? 'Meta set this account to unlimited unique users / 24h.'
          : known
            ? `This connected number’s Meta ceiling is ${cap} unique people / 24 hours.`
            : 'Waiting for Meta to send this number’s messaging-limit tier.'}
      </p>
      <p>
        Remaining unused unique people right now is only in WhatsApp Manager → Messaging limits. Meta does not give
        apps that leftover number, so Samyoj never invents “187 left.”
      </p>
      <p>
        Meta counts unique people you template outside an open 24h chat. Inbox replies inside a chat do not use this
        cap. After enough high-quality unique sends, Meta raises the ceiling (250 → 2,000 → 10,000 → 100,000 →
        Unlimited). Same Graph field for a new Cloud API number and an older verified account.
      </p>
    </div>
  );
}

export default function LiveMetricsHero({
  messagesSent,
  qualityRating,
  messagingLimitTier,
  period,
  onPeriodChange,
}: LiveMetricsHeroProps) {
  const quality = qualityCopy(qualityRating);
  const limit = formatMessagingLimitTier(messagingLimitTier);

  return (
    <section
      aria-label="Live metrics"
      className="relative overflow-hidden rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/95 via-teal-50/35 to-white p-3 shadow-xs sm:rounded-3xl sm:p-5"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(16,185,129,0.08),_transparent_55%)]" />

      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/95 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-emerald-700 sm:px-2.5 sm:py-1 sm:text-[10.5px]">
            <span className="relative flex h-1.5 w-1.5 shrink-0 sm:h-2 sm:w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 sm:h-2 sm:w-2" />
            </span>
            <span className="sm:hidden">Live</span>
            <span className="hidden sm:inline">Live metrics</span>
          </span>
          <MetricsPeriodPicker period={period} onPeriodChange={onPeriodChange} />
        </div>

        <div className="mt-2.5 flex flex-col gap-2.5 sm:mt-3 sm:gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-neutral-600 sm:text-[13px]">Total messages sent</p>
            <p className="mt-0.5 text-[1.75rem] font-black leading-none tracking-tight tabular-nums text-neutral-950 sm:text-[3rem]">
              {messagesSent.toLocaleString()}
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-1.5 sm:gap-2.5 lg:w-auto lg:min-w-[min(100%,20rem)]">
            <MiniCard
              label="Quality rating"
              tipLabel="Quality rating explained"
              tip={
                <div className="space-y-2 font-medium text-neutral-950">
                  <p className="font-extrabold">
                    High / Medium / Low is Meta’s phone quality for this connected number.
                  </p>
                  <p>
                    It is separate from the daily unique-user cap. Low quality can slow or freeze tier upgrades. Same
                    rating field for a new number and an existing verified account.
                  </p>
                </div>
              }
            >
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[13px] font-extrabold sm:text-[15px] ${quality.chip}`}>
                {quality.label}
              </span>
            </MiniCard>
            <MiniCard
              label="Meta daily limit"
              tipLabel="Meta daily limit explained"
              tip={<LimitTip cap={limit.cap} known={limit.known} unlimited={limit.unlimited} />}
            >
              <p className="text-[1.15rem] font-extrabold leading-none tabular-nums text-neutral-950 sm:text-[1.45rem]">
                {limit.cap}
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-neutral-400">
                {limit.unlimited ? 'business messaging' : limit.known ? 'unique users / 24h' : 'Waiting for Meta'}
              </p>
            </MiniCard>
          </div>
        </div>
      </div>
    </section>
  );
}
