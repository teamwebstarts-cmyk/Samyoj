import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, Users } from 'lucide-react';
import { billingApi, campaignApi, contactApi } from '../../services/api';
import { validatePhoneLines } from '../../utils/phone';
import { messagingConsent } from '../../utils/plainLanguage';

type AudienceType = 'MANUAL' | 'TAGS' | 'CONTACTS' | 'ALL_OPTED_IN';

export interface AudiencePreviewMetrics {
  total: number | null;
  optedIn: number | null;
  notOptedIn: number | null;
  estimatedFailed: number | null;
  estimatedReach: number | null;
}

interface CampaignAudiencePreviewProps {
  audienceType: AudienceType;
  phones: string;
  audienceTags: string;
  selectedContactIds: string[];
  requestedCount?: number;
  audienceTypes?: Array<'TAGS' | 'CONTACTS' | 'ALL_OPTED_IN' | 'MANUAL'>;
  audienceOperator?: 'OR' | 'AND';
  onCountChange?: (count: number | null) => void;
  onCostChange?: (cost: number | null) => void;
  onMetricsChange?: (metrics: AudiencePreviewMetrics | null) => void;
  variant?: 'default' | 'wizard';
  showMetrics?: boolean;
  templateCategory?: string;
}

function formatMetric(value: number | null | undefined) {
  return value == null ? '—' : value.toLocaleString();
}

export default function CampaignAudiencePreview({
  audienceType,
  phones,
  audienceTags,
  selectedContactIds,
  requestedCount,
  audienceTypes,
  audienceOperator = 'OR',
  onCountChange,
  onCostChange,
  onMetricsChange,
  variant = 'default',
  showMetrics = true,
  templateCategory,
}: CampaignAudiencePreviewProps) {
  const [count, setCount] = useState<number | null>(null);
  const [costInr, setCostInr] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [metrics, setMetrics] = useState<AudiencePreviewMetrics | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setStale(false);
      setError(null);
      setCostInr(null);
      onCountChange?.(null);
      onCostChange?.(null);
      onMetricsChange?.(null);
      setMetrics(null);

      try {
        let payload: Record<string, unknown>;
        const activeAudienceTypes = audienceTypes?.length ? audienceTypes : [audienceType];
        const hasTags = activeAudienceTypes.includes('TAGS');
        const hasContacts = activeAudienceTypes.includes('CONTACTS');

        if (hasTags && hasContacts) {
          const tags = audienceTags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);
          if (!tags.length) {
            setError('Add at least one tag');
            onCountChange?.(null);
            onCostChange?.(null);
            onMetricsChange?.(null);
            setMetrics(null);
            return;
          }
          if (!selectedContactIds.length) {
            setError('Select at least one contact');
            onCountChange?.(null);
            onCostChange?.(null);
            onMetricsChange?.(null);
            setMetrics(null);
            return;
          }
          payload = {
            audienceType: 'CONTACTS',
            audienceConfig: {
              groups: [
                { type: 'TAGS', tags },
                { type: 'CONTACTS', contactIds: selectedContactIds },
              ],
              operator: audienceOperator,
              requireOptIn: true,
            },
          };
        } else if (audienceType === 'MANUAL') {
          const result = validatePhoneLines(phones.split('\n'));
          if (!result.ok) {
            setCount(null);
            onCountChange?.(null);
            onCostChange?.(null);
            onMetricsChange?.(null);
            setMetrics(null);
            setError(result.errors[0]);
            return;
          }
          payload = {
            audienceType: 'MANUAL',
            recipients: result.phones.map((phone) => ({ phone })),
          };
        } else if (audienceType === 'TAGS') {
          const tags = audienceTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
          if (!tags.length) {
            setCount(null);
            onCountChange?.(null);
            onCostChange?.(null);
            onMetricsChange?.(null);
            setMetrics(null);
            setError('Add at least one tag');
            return;
          }
          payload = {
            audienceType: 'TAGS',
            audienceConfig: { tags, requireOptIn: true },
          };
        } else if (audienceType === 'CONTACTS') {
          if (!selectedContactIds.length) {
            setCount(null);
            onCountChange?.(null);
            onCostChange?.(null);
            onMetricsChange?.(null);
            setMetrics(null);
            setError('Select at least one contact');
            return;
          }
          payload = {
            audienceType: 'CONTACTS',
            audienceConfig: { contactIds: selectedContactIds, requireOptIn: true },
          };
        } else {
          payload = {
            audienceType: 'ALL_OPTED_IN',
            audienceConfig: { requireOptIn: true },
          };
        }

        const { data } = await campaignApi.previewAudience(payload);
        if (!cancelled) {
          const response = data.data as {
            count: number;
            total?: number;
            optedIn?: number;
            notOptedIn?: number;
            estimatedFailed?: number;
            estimatedReach?: number;
          };
          const eligibleCount = response.count;
          let total = response.total ?? requestedCount ?? eligibleCount;
          let optedIn = response.optedIn ?? eligibleCount;

          if (
            audienceType === 'ALL_OPTED_IN' &&
            response.total === undefined &&
            response.optedIn === undefined
          ) {
            try {
              const contactResponse = await contactApi.list({ page: '1', limit: '1' });
              const summary = contactResponse.data.data.summary as
                | { total?: number; optedIn?: number }
                | undefined;
              total = summary?.total ?? total;
              optedIn = eligibleCount;
            } catch {
              // The campaign preview remains usable even if contact summary data is unavailable.
            }
          }

          const notOptedIn =
            response.notOptedIn ?? (total === null ? null : Math.max(0, total - optedIn));
          const estimatedFailed =
            response.estimatedFailed ?? Math.max(0, Math.round(eligibleCount * 0.01));
          const estimatedReach =
            response.estimatedReach ?? Math.max(0, eligibleCount - estimatedFailed);
          const metrics: AudiencePreviewMetrics = {
            total,
            optedIn,
            notOptedIn,
            estimatedFailed,
            estimatedReach,
          };

          if (cancelled) return;
          setCount(eligibleCount);
          setMetrics(metrics);
          onCountChange?.(eligibleCount);
          onMetricsChange?.(metrics);
          if (eligibleCount === 0) {
            setCostInr(null);
            onCostChange?.(null);
            setError(messagingConsent.noMatchingAudience);
          } else {
            const est = await billingApi.estimateCost(eligibleCount, templateCategory);
            if (!cancelled) {
              setCostInr(est.data.data.estimatedCostInr);
              onCostChange?.(est.data.data.estimatedCostInr);
            }
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setCount(null);
          onCountChange?.(null);
          onCostChange?.(null);
          onMetricsChange?.(null);
          setMetrics(null);
          setCostInr(null);
          setError(
            (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
              ?.message || 'Audience preview could not load. Check your selection and try again.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timer = setTimeout(() => void load(), 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    audienceType,
    phones,
    audienceTags,
    selectedContactIds,
    requestedCount,
    audienceTypes,
    audienceOperator,
    templateCategory,
    onCountChange,
    onCostChange,
    onMetricsChange,
  ]);

  useEffect(() => {
    setStale(count !== null);
  }, [audienceType, phones, audienceTags, selectedContactIds]);

  if (variant === 'wizard') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`overflow-hidden rounded-xl border ${
          error
            ? 'border-amber-200/80 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20'
            : count !== null && count > 0
              ? 'border-emerald-200/80 bg-emerald-50/55 dark:border-emerald-900/50 dark:bg-emerald-950/20'
              : 'border-theme-border bg-theme-subtle/40'
        }`}
      >
        {loading ? (
          <div className="flex items-center gap-2.5 px-3 py-3 text-[11px] font-semibold text-theme-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            Checking audience eligibility…
          </div>
        ) : error ? (
          <div className="flex items-start gap-2.5 px-3 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-[11px] font-extrabold text-amber-900 dark:text-amber-200">
                Audience needs attention
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">{error}</p>
            </div>
          </div>
        ) : count !== null ? (
          <div className="space-y-2.5 p-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
              <div>
                <p className="text-[11px] font-extrabold text-emerald-900 dark:text-emerald-200">
                  Audience looks good
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
                  Your campaign will be sent to opted-in contacts only.
                </p>
              </div>
            </div>
            {showMetrics && (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Opted-in recipients', value: formatMetric(metrics?.optedIn ?? count) },
                    { label: 'Estimated failed', value: formatMetric(metrics?.estimatedFailed) },
                    { label: 'Estimated to reach', value: formatMetric(metrics?.estimatedReach) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-emerald-100 bg-white/70 px-2 py-2 dark:border-emerald-900/40 dark:bg-slate-950/30">
                      <p className="text-[9px] font-semibold text-theme-muted">{item.label}</p>
                      <p className="mt-1 text-[11px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 border-t border-emerald-100 pt-2 text-[9px] font-semibold text-theme-muted dark:border-emerald-900/40">
                  <Info className="h-3 w-3 shrink-0 text-sky-600" />
                  Only opted-in contacts will receive this campaign.
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="px-3 py-3 text-[10px] font-semibold text-theme-secondary">
            Choose an audience to preview the estimated reach.
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`overflow-hidden rounded-2xl border ${
        error
          ? 'border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20'
          : count !== null && count > 0
            ? 'border-sky-200/80 bg-gradient-to-r from-sky-50/80 via-theme-surface to-emerald-50/50 dark:border-sky-800/40 dark:from-sky-950/25 dark:via-transparent dark:to-emerald-950/20'
            : 'border-theme-border bg-theme-subtle/40'
      }`}
    >
      <div className="flex items-center gap-4 px-4 py-3.5">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            error
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              : 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.28)]'
          }`}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : error ? (
            <AlertCircle className="h-5 w-5" strokeWidth={2.25} />
          ) : (
            <Users className="h-5 w-5" strokeWidth={2.25} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-theme-muted">
            Recipients included
          </p>
          {loading ? (
            <p className="mt-0.5 text-[13px] font-semibold text-theme-secondary">
              Checking your audience…
            </p>
          ) : stale ? (
            <p className="mt-0.5 text-[13px] font-semibold text-amber-800 dark:text-amber-300">
              Audience changed — updating…
            </p>
          ) : error ? (
            <p className="mt-0.5 text-[13px] font-semibold text-amber-800 dark:text-amber-300">
              {error}
            </p>
          ) : count !== null ? (
            <div>
              <p className="mt-0.5 text-[13px] font-medium text-theme-secondary">
                <span className="text-2xl font-extrabold tabular-nums text-sky-700 dark:text-sky-400">
                  {count.toLocaleString()}
                </span>{' '}
                <span className="font-semibold text-theme-fg">
                  {count === 1 ? 'person is' : 'people are'} included in this campaign
                </span>
              </p>
              {costInr != null && costInr > 0 && (
                <p className="mt-1 text-[12px] font-semibold text-amber-800 dark:text-amber-300">
                  Estimated campaign cost: ₹{costInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              )}
              {requestedCount != null && count < requestedCount && (
                <p className="mt-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                  {requestedCount - count} selected contact{requestedCount - count === 1 ? '' : 's'} can’t receive this message and won’t be included.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-0.5 text-[13px] font-medium text-theme-secondary">
              Choose an audience to see how many people are included
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
