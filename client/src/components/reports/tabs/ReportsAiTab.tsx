import {
  Bot,
  Coins,
  UserX,
  Workflow,
  Zap,
} from 'lucide-react';
import AiKnowledgeGapTable from '../tables/AiKnowledgeGapTable';
import type { ReportsAiDeflectionData } from '../../../types';

interface ReportsAiTabProps {
  data: ReportsAiDeflectionData;
}

export default function ReportsAiTab({ data }: ReportsAiTabProps) {
  const { summary, featureBreakdown, fallbackQueries } = data;

  const kpis = [
    {
      title: 'Bot Containment Rate',
      value: `${summary.containmentRate}%`,
      sub: `${summary.resolvedByAi} resolved without human`,
      icon: Bot,
      color:
        summary.containmentRate >= 70
          ? 'text-emerald-700 dark:text-emerald-300'
          : 'text-amber-700 dark:text-amber-300',
      bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    },
    {
      title: 'Human Escalation Rate',
      value: `${summary.escalationRate}%`,
      sub: `${summary.handoffsToHuman} bot-to-human handoffs`,
      icon: UserX,
      color: 'text-sky-700 dark:text-sky-300',
      bg: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
    },
    {
      title: 'Avg Bot Handling Time',
      value: `${summary.avgHandlingSeconds}s`,
      sub: 'Instant resolution speed',
      icon: Zap,
      color: 'text-violet-700 dark:text-violet-300',
      bg: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    },
    {
      title: 'Automations Executed',
      value: summary.automationsRun.toLocaleString(),
      sub: 'Keyword, welcome, & flow triggers',
      icon: Workflow,
      color: 'text-indigo-700 dark:text-indigo-300',
      bg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
    },
    {
      title: 'Estimated AI Cost',
      value: `₹${summary.estimatedCostINR.toLocaleString()}`,
      sub: `$${summary.estimatedCostUSD} (${(summary.totalTokens / 1000).toFixed(0)}k tokens)`,
      icon: Coins,
      color: 'text-amber-700 dark:text-amber-300',
      bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Bot Deflection & Containment Hero */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.title}
              className="dashboard-card relative flex flex-col justify-between p-4 transition hover:border-whatsapp-500/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                  {kpi.title}
                </span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${kpi.bg}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>

              <div className="mt-3">
                <p className={`text-2xl font-black tabular-nums tracking-tight ${kpi.color}`}>
                  {kpi.value}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-theme-muted truncate">
                  {kpi.sub}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Feature Consumption Breakdown */}
      <div className="dashboard-card overflow-hidden">
        <div className="border-b border-theme-border bg-theme-subtle/50 px-5 py-4">
          <h3 className="text-base font-extrabold tracking-tight text-theme-fg">
            AI Feature Utilization & Token Consumption
          </h3>
          <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
            Token usage and estimated compute costs across all AI surfaces
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-theme-border text-[10px] font-bold uppercase tracking-[0.08em] text-theme-muted">
                <th className="px-5 py-3">AI Surface / Feature</th>
                <th className="px-5 py-3">API Requests</th>
                <th className="px-5 py-3">Prompt Tokens</th>
                <th className="px-5 py-3">Completion Tokens</th>
                <th className="px-5 py-3">Total Tokens</th>
                <th className="px-5 py-3 text-right">Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {featureBreakdown.map((f) => {
                const costUSD = Number(((f.totalTokens / 1000) * 0.002).toFixed(2));
                const costINR = Number((costUSD * 86.5).toFixed(0));

                return (
                  <tr
                    key={f.label}
                    className="border-t border-theme-border/60 transition-colors hover:bg-theme-subtle/40"
                  >
                    <td className="px-5 py-3.5 font-bold text-theme-fg">{f.label}</td>
                    <td className="px-5 py-3.5 tabular-nums text-theme-secondary">
                      {f.requests.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-theme-muted">
                      {f.promptTokens.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-theme-muted">
                      {f.completionTokens.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-semibold tabular-nums text-theme-fg">
                      {f.totalTokens.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold tabular-nums text-amber-700 dark:text-amber-300">
                      ₹{costINR.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Knowledge Gaps & Unrecognized Queries */}
      <AiKnowledgeGapTable queries={fallbackQueries} />
    </div>
  );
}
