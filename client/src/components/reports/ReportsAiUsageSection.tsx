import { Bot } from 'lucide-react';
import type { AiUsageSummary } from '../../types';

function formatUnits(value: number) {
  return value.toLocaleString();
}

export default function ReportsAiUsageSection({ usage }: { usage: AiUsageSummary }) {
  const limit = usage.monthlyTokenLimit;
  const monthPct =
    limit && limit > 0 ? Math.min(100, Math.round((usage.monthTokens / limit) * 100)) : null;

  return (
    <section className="dashboard-card overflow-hidden p-5 sm:p-6 animate-fade-up">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-sky-100 text-sky-700 dark:from-sky-900/40 dark:to-sky-800/30 dark:text-sky-300">
          <Bot className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-extrabold tracking-tight text-theme-fg">AI usage</h2>
          <p className="mt-0.5 text-[12px] font-medium text-theme-muted">
            Each AI feature on this WhatsApp number, for the selected period. Units only — not
            rupees, and not WhatsApp message fees.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <UsageStat label="Requests" value={formatUnits(usage.totalRequests)} />
        <UsageStat label="Input units" value={formatUnits(usage.promptTokens)} hint="What we sent" />
        <UsageStat
          label="Output units"
          value={formatUnits(usage.completionTokens)}
          hint="What came back"
        />
        <UsageStat label="This month" value={formatUnits(usage.monthTokens)} />
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
          <span className="font-semibold text-theme-secondary">This month vs limit</span>
          <span className="font-extrabold tabular-nums text-theme-fg">
            {limit && limit > 0
              ? `${formatUnits(usage.monthTokens)} / ${formatUnits(limit)}`
              : `${formatUnits(usage.monthTokens)} · no monthly cap`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-theme-subtle ring-1 ring-theme-border/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-600 transition-all duration-700 ease-out"
            style={{ width: `${monthPct ?? (usage.monthTokens > 0 ? 8 : 0)}%` }}
          />
        </div>
        {usage.monthRemaining != null && (
          <p className="mt-1.5 text-[11px] font-medium text-theme-muted">
            {formatUnits(usage.monthRemaining)} units left this month
          </p>
        )}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-[12px]">
          <thead>
            <tr className="border-b border-theme-border text-[11px] font-bold uppercase tracking-wide text-theme-muted">
              <th className="pb-2 pr-3 font-bold">Feature</th>
              <th className="pb-2 pr-3 text-right font-bold">Requests</th>
              <th className="pb-2 pr-3 text-right font-bold">Input</th>
              <th className="pb-2 pr-3 text-right font-bold">Output</th>
              <th className="pb-2 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {(usage.surfaces ?? []).map((row) => (
              <tr key={row.action} className="border-b border-theme-border/60 last:border-0">
                <td className="py-2.5 pr-3 font-semibold text-theme-fg">{row.label}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-theme-secondary">
                  {formatUnits(row.requests)}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-theme-secondary">
                  {formatUnits(row.promptTokens)}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-theme-secondary">
                  {formatUnits(row.completionTokens)}
                </td>
                <td className="py-2.5 text-right tabular-nums font-bold text-theme-fg">
                  {formatUnits(row.totalTokens)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-theme-muted">
        {usage.unitNote ||
          'Figures are usage units (tokens for language models, characters for listening/speaking). They are not rupees and do not include WhatsApp message fees.'}
      </p>
    </section>
  );
}

function UsageStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-theme-border/70 bg-theme-subtle/50 px-3.5 py-3">
      <p className="text-[11px] font-semibold text-theme-muted">{label}</p>
      <p className="mt-1 text-[1.15rem] font-extrabold tabular-nums tracking-tight text-theme-fg">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] font-medium text-theme-muted">{hint}</p>}
    </div>
  );
}
