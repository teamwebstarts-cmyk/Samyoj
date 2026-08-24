import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { CampaignAnalytics } from '../../types';
import { formatRecipientError } from '../../utils/plainLanguage';

interface CampaignAnalyticsPanelProps {
  analytics: CampaignAnalytics | null;
  loading?: boolean;
  error?: string | null;
  section?: 'overview' | 'errors';
  onRetryFailed?: () => void;
}

export default function CampaignAnalyticsPanel({
  analytics,
  loading,
  error,
  section = 'overview',
  onRetryFailed,
}: CampaignAnalyticsPanelProps) {
  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="h-16 rounded-xl bg-slate-100 dark:bg-slate-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200/80 bg-red-50/60 px-4 py-3 text-[13px] font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (!analytics) return null;

  const { campaign, topErrors, byStatus } = analytics;

  if (section === 'overview') {
    if (campaign.failedCount > 0) {
      return (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-200/80 bg-red-50/50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-[12px] font-semibold text-red-900 dark:text-red-100">
            {campaign.failedCount.toLocaleString()} failed — open the Failed tab for details.
          </p>
        </div>
      );
    }
    if (byStatus.PENDING) {
      return (
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/50 px-4 py-3 text-[12px] font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          Delivery in progress — stats update as WhatsApp confirms each message.
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-red-200/80 bg-red-50/40 p-4 dark:border-red-900/50 dark:bg-red-950/20">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-red-900 dark:text-red-100">
            {campaign.failedCount.toLocaleString()} failed
          </p>
          <p className="mt-0.5 text-[12px] font-medium text-red-800/85 dark:text-red-200/80">
            Fix the issue below, then retry.
          </p>
        </div>
        {campaign.failedCount > 0 && onRetryFailed && (
          <button
            type="button"
            onClick={onRetryFailed}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-red-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        )}
      </div>
      {topErrors.length > 0 && (
        <ul className="space-y-1.5 border-t border-red-200/60 pt-3 dark:border-red-900/40">
          {topErrors.slice(0, 5).map((err) => (
            <li
              key={err.message}
              className="text-[12px] font-medium leading-snug text-red-900/90 dark:text-red-100/90"
            >
              <span className="font-extrabold tabular-nums">{err.count}×</span>{' '}
              {formatRecipientError(err.message)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
