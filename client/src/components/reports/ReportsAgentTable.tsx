import { Users } from 'lucide-react';
import AvailabilityBadge from '../team/AvailabilityBadge';
import EmptyState from '../ui/EmptyState';
import type { ReportsData } from '../../types';

interface ReportsAgentTableProps {
  agents: ReportsData['agentPerformance'];
  periodDays: number;
}

function agentInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ReportsAgentTable({ agents, periodDays }: ReportsAgentTableProps) {
  const sorted = [...agents].sort((a, b) => b.messagesSent - a.messagesSent);
  const topMessages = sorted[0]?.messagesSent ?? 0;

  return (
    <div className="dashboard-card overflow-hidden animate-fade-up-delay-2">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-theme-border bg-theme-subtle/50 px-5 py-4">
        <div>
          <h3 className="text-base font-extrabold tracking-tight text-theme-fg">Agent performance</h3>
          <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
            Team activity over the last {periodDays} days
          </p>
        </div>
        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:ring-violet-800/50">
          {sorted.length} {sorted.length === 1 ? 'agent' : 'agents'}
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={Users}
            compact
            title="No agent activity yet"
            description="Performance numbers appear once your team starts handling customer chats."
            steps={['Invite team members', 'Assign chats from Inbox', 'Check back here for response times and stats']}
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-theme-border text-[10px] font-bold uppercase tracking-[0.08em] text-theme-muted">
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3">Messages</th>
                <th className="px-5 py-3">Open</th>
                <th className="px-5 py-3">Closed</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((agent, index) => {
                const msgPct =
                  topMessages > 0 ? Math.round((agent.messagesSent / topMessages) * 100) : 0;

                return (
                  <tr
                    key={agent.agentId}
                    className="border-t border-theme-border transition-colors hover:bg-theme-subtle/40"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 text-[11px] font-extrabold text-violet-800 dark:from-violet-900/50 dark:to-purple-900/40 dark:text-violet-200">
                            {agentInitials(agent.name)}
                          </div>
                          {index === 0 && agent.messagesSent > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] font-black text-white ring-2 ring-white dark:ring-theme-surface">
                              1
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-theme-fg">{agent.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="min-w-[120px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold tabular-nums text-theme-fg">
                            {agent.messagesSent}
                          </span>
                          <span className="text-[10px] font-semibold text-theme-muted">{msgPct}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-theme-subtle">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-600 transition-all duration-700"
                            style={{ width: `${msgPct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex min-w-[2rem] items-center justify-center rounded-lg bg-amber-50 px-2 py-0.5 text-[12px] font-bold tabular-nums text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        {agent.openAssigned}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex min-w-[2rem] items-center justify-center rounded-lg bg-emerald-50 px-2 py-0.5 text-[12px] font-bold tabular-nums text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                        {agent.closedLastPeriod}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <AvailabilityBadge status={agent.availability} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
