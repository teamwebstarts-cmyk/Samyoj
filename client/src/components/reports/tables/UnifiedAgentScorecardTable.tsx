import { useState, useMemo } from 'react';
import { Download, Trophy, Users } from 'lucide-react';
import AvailabilityBadge from '../../team/AvailabilityBadge';
import EmptyState from '../../ui/EmptyState';
import SearchInput from '../../ui/SearchInput';
import AppButton from '../../ui/AppButton';
import type { AgentScorecard } from '../../../types';

interface UnifiedAgentScorecardTableProps {
  agents: AgentScorecard[];
  periodDays?: number;
  onExportCsv?: () => void;
}

export type AgentSortField =
  | 'productivityScore'
  | 'messagesSent'
  | 'resolvedChats'
  | 'assignedActive'
  | 'avgFirstResponseMinutes';

function agentInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function UnifiedAgentScorecardTable({
  agents,
  onExportCsv,
}: UnifiedAgentScorecardTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<AgentSortField>('productivityScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    let list = [...agents];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          (a.department && a.department.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let valA = a[sortField] ?? 0;
      let valB = b[sortField] ?? 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      return 0;
    });

    return list;
  }, [agents, search, sortField, sortDir]);

  const handleSort = (field: AgentSortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  return (
    <div className="dashboard-card overflow-hidden animate-fade-up">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 border-b border-theme-border bg-theme-subtle/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-extrabold tracking-tight text-theme-fg">Agent Performance Scorecard</h3>
          <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
            Workload, response speed, and resolution quality across your team
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-48">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search agent..."
              compact
            />
          </div>
          {onExportCsv && (
            <AppButton size="sm" variant="secondary" icon={<Download size={13} />} onClick={onExportCsv}>
              CSV
            </AppButton>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8">
          <EmptyState
            icon={Users}
            compact
            title="No agents match your filter"
            description="Clear the search bar or ensure your team members are assigned to customer conversations."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-theme-border text-[10px] font-bold uppercase tracking-[0.08em] text-theme-muted">
                <th className="w-10 px-4 py-3">#</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Status</th>
                <th
                  className="cursor-pointer px-4 py-3 hover:text-theme-fg"
                  onClick={() => handleSort('assignedActive')}
                >
                  Active Open {sortField === 'assignedActive' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="cursor-pointer px-4 py-3 hover:text-theme-fg"
                  onClick={() => handleSort('resolvedChats')}
                >
                  Resolved {sortField === 'resolvedChats' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="cursor-pointer px-4 py-3 hover:text-theme-fg"
                  onClick={() => handleSort('messagesSent')}
                >
                  Replies {sortField === 'messagesSent' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="cursor-pointer px-4 py-3 hover:text-theme-fg"
                  onClick={() => handleSort('avgFirstResponseMinutes')}
                >
                  Avg FRT {sortField === 'avgFirstResponseMinutes' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right hover:text-theme-fg"
                  onClick={() => handleSort('productivityScore')}
                >
                  Score {sortField === 'productivityScore' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((agent, index) => {
                const frtVal = agent.avgFirstResponseMinutes;
                const frtColor =
                  frtVal == null
                    ? 'text-theme-muted'
                    : frtVal <= 5
                      ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                      : frtVal <= 15
                        ? 'text-amber-700 dark:text-amber-300 font-bold'
                        : 'text-rose-700 dark:text-rose-300 font-bold';

                return (
                  <tr
                    key={agent.agentId}
                    className="border-t border-theme-border/60 transition-colors hover:bg-theme-subtle/40"
                  >
                    <td className="px-4 py-3.5 font-bold tabular-nums text-theme-muted">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 text-[11px] font-extrabold text-violet-800 dark:from-violet-900/50 dark:to-purple-900/40 dark:text-violet-200">
                            {agentInitials(agent.name)}
                          </div>
                          {index === 0 && agent.productivityScore > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[7px] font-black text-white ring-2 ring-white dark:ring-theme-surface">
                              <Trophy className="h-2 w-2" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-theme-fg">{agent.name}</p>
                          <p className="truncate text-[11px] text-theme-muted">
                            {agent.department || agent.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <AvailabilityBadge status={agent.availability} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex min-w-[1.75rem] items-center justify-center rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        {agent.assignedActive}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold tabular-nums text-theme-fg">
                      {agent.resolvedChats}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-theme-secondary">
                      {agent.messagesSent}
                    </td>
                    <td className={`px-4 py-3.5 tabular-nums ${frtColor}`}>
                      {frtVal != null ? `${frtVal}m` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-black tabular-nums text-theme-fg">
                      {agent.productivityScore}
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
