import { BarChart3, IndianRupee, MessageSquare, Shield } from 'lucide-react';
import type { BillingUsage } from '../../types';

interface BillingUsageWidgetProps {
  usage: BillingUsage;
  dailyBudgetInr?: number;
}

function formatInr(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BillingUsageWidget({ usage, dailyBudgetInr }: BillingUsageWidgetProps) {
  const categories = Object.entries(usage.byCategory);

  return (
    <div className="dashboard-card overflow-hidden animate-fade-up-delay">
      <div className="flex items-center gap-2 border-b border-theme-border bg-theme-subtle/50 px-5 py-4">
        <BarChart3 className="h-4 w-4 text-theme-muted" />
        <div>
          <h3 className="text-base font-extrabold tracking-tight text-theme-fg">
            WhatsApp usage — last {usage.period}
          </h3>
          <p className="text-[12px] font-medium text-theme-secondary">
            Conversation charges and quality ratings from Meta
          </p>
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-3">
        <div className="rounded-xl border border-theme-border bg-theme-subtle/30 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-theme-muted">
            <MessageSquare className="h-3.5 w-3.5" />
            Conversations
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-theme-fg">
            {usage.totalConversations.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="rounded-xl border border-theme-border bg-theme-subtle/30 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-theme-muted">
            <IndianRupee className="h-3.5 w-3.5" />
            Estimated cost
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
            {formatInr(usage.totalCostInr)}
          </p>
        </div>
        <div className="rounded-xl border border-theme-border bg-theme-subtle/30 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-theme-muted">
            <Shield className="h-3.5 w-3.5" />
            Quality
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {usage.qualityRatings.map((q) => {
              const rating = q.qualityRating.toUpperCase();
              const color =
                rating === 'GREEN'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : rating === 'YELLOW'
                    ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                    : rating === 'RED'
                      ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-theme-subtle text-theme-secondary';
              return (
                <span
                  key={q.phoneNumber}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${color}`}
                >
                  {q.phoneNumber}: {rating}
                </span>
              );
            })}
            {usage.qualityRatings.length === 0 && (
              <span className="text-[12px] font-medium text-theme-muted">No data yet</span>
            )}
          </div>
        </div>
      </div>

      {dailyBudgetInr != null && dailyBudgetInr > 0 && (
        <div className="border-t border-theme-border px-5 py-4">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-theme-muted">
            Daily Meta budget cap
          </p>
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold text-theme-fg">Spent (est.)</span>
            <span className="tabular-nums text-theme-secondary">
              {formatInr(usage.totalCostInr)} / {formatInr(dailyBudgetInr)}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-theme-subtle">
            <div
              className={`h-full rounded-full ${
                usage.totalCostInr / dailyBudgetInr > 0.9 ? 'bg-red-500' : 'bg-whatsapp-500'
              }`}
              style={{ width: `${Math.min(100, (usage.totalCostInr / dailyBudgetInr) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {categories.length > 0 && (
        <div className="border-t border-theme-border px-5 py-4">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-theme-muted">
            By category
          </p>
          <div className="space-y-2">
            {categories.map(([category, stats]) => (
              <div key={category} className="flex items-center justify-between text-[13px]">
                <span className="font-semibold text-theme-fg">{category}</span>
                <span className="tabular-nums text-theme-secondary">
                  {stats.count.toLocaleString('en-IN')} conv · {formatInr(stats.costInr)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
