import { AlertTriangle, BarChart3, RefreshCw } from 'lucide-react';
import { ModalEmptyHint, ModalPanel } from '../ui/modalUi';
import type { CampaignAnalytics } from '../../types';

interface CampaignAnalyticsPanelProps {
  analytics: CampaignAnalytics | null;
  loading?: boolean;
  error?: string | null;
  section?: 'overview' | 'errors';
  onViewFailures?: () => void;
  onRetryFailed?: () => void;
}

export default function CampaignAnalyticsPanel({
  analytics,
  loading,
  error,
  section = 'overview',
  onViewFailures,
  onRetryFailed,
}: CampaignAnalyticsPanelProps) {
  if (loading) {
    return (
      <ModalPanel title="Campaign analytics" icon={BarChart3} accent="indigo">
        <div className="animate-pulse space-y-3">
          <div className="h-20 rounded-xl bg-theme-subtle" />
          <div className="h-16 rounded-xl bg-theme-subtle" />
        </div>
      </ModalPanel>
    );
  }

  if (error) {
    return (
      <ModalPanel title="Campaign analytics" icon={BarChart3} accent="indigo">
        <p className="text-[13px] font-medium text-red-600 dark:text-red-400">{error}</p>
      </ModalPanel>
    );
  }

  if (!analytics) return null;

  const { campaign, byStatus, topErrors } = analytics;

  const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300',
    SENT: 'bg-sky-50 text-sky-800 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-300',
    DELIVERED: 'bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300',
    READ: 'bg-violet-50 text-violet-800 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-300',
    FAILED: 'bg-red-50 text-red-800 ring-red-100 dark:bg-red-950/40 dark:text-red-300',
  };

  if (section === 'errors') {
    return (
      <ModalPanel title="Errors" icon={AlertTriangle} accent="neutral">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200/70 bg-red-50/70 px-3.5 py-3 dark:border-red-900/50 dark:bg-red-950/25">
            <div>
              <p className="text-[12px] font-extrabold text-red-900 dark:text-red-200">
                {campaign.failedCount.toLocaleString()} failed recipient{campaign.failedCount === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-[11px] font-medium text-red-800/80 dark:text-red-300/80">
                Review the recipient error text below, then retry only after fixing the cause.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {onViewFailures && (
                <button type="button" onClick={onViewFailures} className="min-h-11 rounded-lg border border-red-200 bg-theme-surface px-3 py-2 text-[11px] font-bold text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300">
                  View failed recipients
                </button>
              )}
              {campaign.failedCount > 0 && onRetryFailed && (
                <button type="button" onClick={onRetryFailed} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-red-700">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry failed sends
                </button>
              )}
            </div>
          </div>
          {topErrors.length > 0 ? (
            <ul className="space-y-2">
              {topErrors.map((err) => (
                <li key={err.message} className="rounded-xl border border-theme-border bg-theme-subtle/40 px-3 py-2.5 text-[12px] text-theme-secondary">
                  <span className="font-extrabold tabular-nums text-red-600 dark:text-red-400">{err.count}×</span>{' '}
                  <span className="font-medium">{err.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ModalEmptyHint message="No error details are available. Check recipients for delivery status." />
          )}
        </div>
      </ModalPanel>
    );
  }

  return (
    <ModalPanel title="Campaign analytics" icon={BarChart3} accent="indigo">
      <div className="space-y-4">
        <div className={`rounded-xl border px-3.5 py-3 ${
          campaign.failedCount > 0
            ? 'border-red-200/70 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/25'
            : 'border-theme-border bg-theme-subtle/40'
        }`}>
          <p className={`text-[12px] font-extrabold ${
            campaign.failedCount > 0 ? 'text-red-900 dark:text-red-200' : 'text-theme-fg'
          }`}>
            {campaign.failedCount > 0
              ? `${campaign.failedCount.toLocaleString()} recipient${campaign.failedCount === 1 ? '' : 's'} need attention`
              : byStatus.PENDING
                ? 'Delivery is still in progress'
                : 'Delivery updates are complete'}
          </p>
          <p className="mt-1 text-[11px] font-medium text-theme-secondary">
            {campaign.failedCount > 0
              ? 'Review the Errors section for recipient-level causes before retrying.'
              : 'Use the status breakdown below for the current recipient state.'}
          </p>
          {campaign.failedCount > 0 && onViewFailures && (
            <button
              type="button"
              onClick={onViewFailures}
              className="mt-2 min-h-11 rounded-lg border border-red-200 bg-theme-surface px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300"
            >
              View failed recipients
            </button>
          )}
        </div>

        {Object.keys(byStatus).length > 0 ? (
          <div className="rounded-xl border border-theme-border bg-theme-subtle/40 p-4">
            <p className="text-[12px] font-extrabold text-theme-fg">Recipient delivery status</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(byStatus).map(([status, count]) => (
                <span
                  key={status}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
                    statusColors[status] ||
                    'bg-theme-subtle text-theme-secondary ring-theme-border'
                  }`}
                >
                  {status}: <span className="tabular-nums">{count}</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <ModalEmptyHint message="Delivery status will appear once sending starts." />
        )}

      </div>
    </ModalPanel>
  );
}
