import { IndianRupee, MessageSquare, Shield } from 'lucide-react';
import SectionCard from '../ui/SectionCard';
import AppAlert from '../ui/AppAlert';
import type { BillingUsage } from '../../types';

interface BillingUsageWidgetProps {
  usage: BillingUsage;
  dailyBudgetInr?: number;
}

function formatInr(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BillingUsageWidget({ usage }: BillingUsageWidgetProps) {
  const categories = Object.entries(usage.byCategory);

  return (
    <SectionCard
      title={`WhatsApp usage estimate — ${usage.period}`}
      subtitle="Estimate only — not your Meta invoice. Open WhatsApp Manager for your actual bill."
      headerAction={
        <a
          href="https://business.facebook.com/billing_hub"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-sky-600 hover:underline dark:text-sky-400"
        >
          View Meta invoice →
        </a>
      }
    >
      <div className="mb-5">
        <AppAlert variant="info">
          These figures use Samyoj estimates based on delivered templates. Meta bills per delivered message at official INR rates directly to your payment card.
        </AppAlert>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <UsageStat
          icon={MessageSquare}
          label="Messages sent"
          value={usage.totalConversations.toLocaleString('en-IN')}
        />
        <UsageStat
          icon={IndianRupee}
          label="Estimated cost"
          value={formatInr(usage.totalCostInr)}
          tone="text-emerald-700 dark:text-emerald-300"
        />
        <div className="rounded-xl border border-theme-border/70 bg-theme-subtle/30 p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-theme-muted">
            <Shield className="h-3.5 w-3.5" />
            Quality
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {usage.qualityRatings.length === 0 ? (
              <span className="text-[12px] text-theme-muted">No data yet</span>
            ) : (
              usage.qualityRatings.map((q) => {
                const rating = q.qualityRating.toUpperCase();
                const color =
                  rating === 'GREEN'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : rating === 'YELLOW'
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      : rating === 'RED'
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        : 'bg-theme-subtle text-theme-secondary';
                return (
                  <span
                    key={q.phoneNumber}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${color}`}
                  >
                    {q.phoneNumber}: {rating}
                  </span>
                );
              })
            )}
          </div>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-theme-border/60 pt-4">
          <p className="text-[12px] font-bold text-theme-secondary">By category</p>
          {categories.map(([category, stats]) => (
            <div
              key={category}
              className="flex items-center justify-between rounded-lg bg-theme-subtle/30 px-3 py-2 text-[13px]"
            >
              <span className="font-semibold text-theme-fg">{category}</span>
              <span className="tabular-nums text-theme-secondary">
                {stats.count.toLocaleString('en-IN')} · {formatInr(stats.costInr)}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function UsageStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof MessageSquare;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-theme-border/70 bg-theme-subtle/30 p-4">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-theme-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`mt-2 text-2xl font-extrabold tabular-nums ${tone ?? 'text-theme-fg'}`}>
        {value}
      </p>
    </div>
  );
}
