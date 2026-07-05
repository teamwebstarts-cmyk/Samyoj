import { Trophy } from 'lucide-react';

export interface LeaderboardAgent {
  name: string;
  messagesSent: number;
  closedChats: number;
  productivityScore: number;
  avgFirstResponseMinutes: number | null;
}

interface ReportsLeaderboardTableProps {
  agents: LeaderboardAgent[];
  periodDays: number;
}

function agentInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ReportsLeaderboardTable({
  agents,
  periodDays,
}: ReportsLeaderboardTableProps) {
  if (agents.length === 0) return null;

  return (
    <div className="dashboard-card overflow-hidden animate-fade-up-delay">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-theme-border bg-theme-subtle/50 px-5 py-4">
        <div>
          <h3 className="text-base font-extrabold tracking-tight text-theme-fg">Agent leaderboard</h3>
          <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
            Ranked by productivity over the last {periodDays} days
          </p>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800/50">
          Top {agents.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-theme-border text-[10px] font-bold uppercase tracking-[0.08em] text-theme-muted">
              <th className="w-12 px-5 py-3">#</th>
              <th className="px-5 py-3">Agent</th>
              <th className="px-5 py-3">Score</th>
              <th className="px-5 py-3">Messages</th>
              <th className="px-5 py-3">Closed</th>
              <th className="px-5 py-3">Avg FRT</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent, index) => (
              <tr
                key={agent.name}
                className="border-t border-theme-border transition-colors hover:bg-theme-subtle/40"
              >
                <td className="px-5 py-3.5 font-bold tabular-nums text-theme-muted">{index + 1}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-[11px] font-extrabold text-amber-800 dark:from-amber-900/50 dark:to-orange-900/40 dark:text-amber-200">
                        {agentInitials(agent.name)}
                      </div>
                      {index === 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] font-black text-white ring-2 ring-white dark:ring-theme-surface">
                          <Trophy className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-theme-fg">{agent.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex min-w-[2rem] items-center justify-center rounded-lg bg-violet-50 px-2 py-0.5 text-[12px] font-bold tabular-nums text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                    {agent.productivityScore}
                  </span>
                </td>
                <td className="px-5 py-3.5 tabular-nums font-semibold text-theme-fg">
                  {agent.messagesSent}
                </td>
                <td className="px-5 py-3.5 tabular-nums text-theme-secondary">{agent.closedChats}</td>
                <td className="px-5 py-3.5 tabular-nums text-theme-secondary">
                  {agent.avgFirstResponseMinutes != null
                    ? `${agent.avgFirstResponseMinutes}m`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
