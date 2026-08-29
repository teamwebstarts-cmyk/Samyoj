import MetricsPeriodPicker from './MetricsPeriodPicker';
import { metricsPeriodCompareLabel, type MetricsPeriod } from '../../utils/metricsPeriod';

export {
  METRICS_PRESET_OPTIONS as LIVE_METRICS_PERIOD_OPTIONS,
  type MetricsPresetDays as LiveMetricsPeriodDays,
} from '../../utils/metricsPeriod';
export type { MetricsPeriod } from '../../utils/metricsPeriod';

const WHATSAPP_MANAGER_PHONE_URL = 'https://business.facebook.com/wa/manage/phone-numbers/';

export type PhoneQualityRating = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN' | string;

interface LiveMetricsHeroProps {
  messagesSent: number;
  qualityRating?: string | null;
  promoConversations?: number | null;
  serviceConversations?: number | null;
  messagingLimitTier?: string | null;
  sentToday?: number | null;
  dailySendLimit?: number | null;
  period: MetricsPeriod;
  onPeriodChange?: (period: MetricsPeriod) => void;
}

function qualityCopy(rating: string | null | undefined): {
  label: 'High' | 'Medium' | 'Low' | 'Unknown';
  chip: string;
  hint: string;
} {
  const value = String(rating || 'UNKNOWN').toUpperCase();
  if (value === 'GREEN') {
    return {
      label: 'High',
      chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
      hint: 'Meta phone quality for this number.',
    };
  }
  if (value === 'YELLOW') {
    return {
      label: 'Medium',
      chip: 'bg-amber-50 text-amber-800 ring-amber-200/80',
      hint: 'Meta flagged this number. Check WhatsApp Manager.',
    };
  }
  if (value === 'RED') {
    return {
      label: 'Low',
      chip: 'bg-rose-50 text-rose-800 ring-rose-200/80',
      hint: 'Meta limited this number. Pause marketing until it recovers.',
    };
  }
  return {
    label: 'Unknown',
    chip: 'bg-neutral-100 text-neutral-700 ring-neutral-200/80',
    hint: 'Waiting for Meta (first poll can take up to a day).',
  };
}

function formatMixCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString();
}

export default function LiveMetricsHero({
  messagesSent,
  qualityRating,
  promoConversations,
  serviceConversations,
  messagingLimitTier,
  sentToday,
  dailySendLimit,
  period,
  onPeriodChange,
}: LiveMetricsHeroProps) {
  const compareLabel = metricsPeriodCompareLabel(period);
  const quality = qualityCopy(qualityRating);
  const hasMix =
    typeof promoConversations === 'number' || typeof serviceConversations === 'number';
  const capLimit = typeof dailySendLimit === 'number' && dailySendLimit > 0 ? dailySendLimit : null;
  const capUsed = typeof sentToday === 'number' ? sentToday : null;
  const capPct =
    capLimit && capUsed != null ? Math.min(100, Math.round((capUsed / capLimit) * 100)) : 0;

  return (
    <section
      aria-label="Live metrics"
      className="relative overflow-hidden rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/95 via-teal-50/35 to-white p-3 shadow-xs sm:rounded-3xl sm:p-5 md:p-6"
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

        <div className="mt-2.5 flex flex-col gap-2.5 sm:mt-4 sm:gap-4 lg:mt-5 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <div className="min-w-0 max-w-xl">
            <p className="text-[11px] font-semibold text-neutral-600 sm:text-[14px]">
              Total messages sent
            </p>
            <p className="mt-0.5 text-[1.75rem] font-black leading-none tracking-tight tabular-nums text-neutral-950 sm:mt-1 sm:pl-4 sm:text-[3.25rem] md:pl-5 md:text-[3.5rem]">
              {messagesSent.toLocaleString()}
            </p>
            <p className="mt-2.5 hidden max-w-md text-[12.5px] font-medium leading-relaxed text-neutral-500 sm:block sm:text-[13px]">
              Phone quality and Meta conversation categories for {compareLabel.replace(/^vs\s+/i, '') || 'this period'}.
            </p>
            {messagingLimitTier ? (
              <p className="mt-2 text-[11px] font-medium text-neutral-500">
                Meta limit: {messagingLimitTier.replace(/_/g, ' ').toLowerCase()} unique users / 24h outside chat window.
                Exact remaining is in WhatsApp Manager.
              </p>
            ) : null}
          </div>

          <div className="grid w-full grid-cols-2 gap-1.5 sm:gap-3 lg:w-auto lg:min-w-[min(100%,22rem)] lg:max-w-xl xl:min-w-[26rem]">
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-neutral-100/90 bg-white px-2 py-2 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_rgba(15,23,42,0.04)] sm:rounded-[1.15rem] sm:px-4 sm:py-4">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-neutral-700 sm:text-[10.5px]">
                Quality
              </p>
              <span
                className={`mt-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[13px] font-extrabold ring-1 sm:text-[15px] ${quality.chip}`}
              >
                {quality.label}
              </span>
              <p className="mt-1.5 max-w-[12rem] text-[10px] font-medium leading-snug text-neutral-400 sm:text-[11px]">
                {quality.hint}
              </p>
              <a
                href={WHATSAPP_MANAGER_PHONE_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-2 text-[10.5px] font-bold text-emerald-700 hover:underline sm:text-[11.5px]"
              >
                Open WhatsApp Manager
              </a>
            </div>
            <div
              className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-neutral-100/90 bg-white px-2 py-2 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_rgba(15,23,42,0.04)] sm:rounded-[1.15rem] sm:px-4 sm:py-4"
              title="Meta conversation categories. Not click-through."
            >
              <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-neutral-700 sm:text-[10.5px]">
                Promo vs service
              </p>
              <p className="mt-1 text-[1.05rem] font-extrabold leading-tight tracking-tight tabular-nums text-neutral-950 sm:mt-2 sm:text-[1.35rem]">
                {hasMix
                  ? `${formatMixCount(promoConversations)} promo · ${formatMixCount(serviceConversations)} service`
                  : '—'}
              </p>
              <p className="mt-1.5 max-w-[13rem] text-[10px] font-medium leading-snug text-neutral-400 sm:text-[11px]">
                {hasMix
                  ? 'Offers vs Service messages (utility, OTP, customer care).'
                  : 'Waiting for Meta conversation analytics.'}
              </p>
            </div>
          </div>
        </div>

        {capLimit != null && capUsed != null ? (
          <div className="mt-3 rounded-xl border border-emerald-100/80 bg-white/70 px-3 py-2 sm:mt-4">
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-neutral-600">
              <span>Samyoj daily send cap</span>
              <span className="tabular-nums text-neutral-900">
                {capUsed.toLocaleString()} / {capLimit.toLocaleString()}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div
                className={`h-full rounded-full ${capPct >= 100 ? 'bg-rose-500' : capPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${capPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
