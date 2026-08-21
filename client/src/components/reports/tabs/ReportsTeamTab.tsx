import {
  Clock,
  Sparkles,
  Timer,
  UserCheck,
} from 'lucide-react';
import PeakHoursHeatmap from '../charts/PeakHoursHeatmap';
import UnifiedAgentScorecardTable from '../tables/UnifiedAgentScorecardTable';
import type { ReportsTeamData, HeatmapCell } from '../../../types';

interface ReportsTeamTabProps {
  teamData: ReportsTeamData;
  heatmapCells: HeatmapCell[];
  onExportCsv: () => void;
}

export default function ReportsTeamTab({
  teamData,
  heatmapCells,
  onExportCsv,
}: ReportsTeamTabProps) {
  const { summary, agentScorecards } = teamData;

  const teamCards = [
    {
      title: 'Avg First Reply (FRT)',
      value: summary.avgFirstResponseMinutes != null ? `${summary.avgFirstResponseMinutes}m` : '—',
      sub: `Median: ${summary.medianFirstResponseMinutes != null ? `${summary.medianFirstResponseMinutes}m` : '—'}`,
      icon: Timer,
      color: 'text-sky-700 dark:text-sky-300',
      bg: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
    },
    {
      title: 'Mean Resolution (MTTR)',
      value: summary.avgResolutionMinutes != null ? `${summary.avgResolutionMinutes}m` : '—',
      sub: 'Time to close conversation',
      icon: Clock,
      color: 'text-violet-700 dark:text-violet-300',
      bg: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    },
    {
      title: 'First Contact Resolution',
      value: `${summary.firstContactResolutionRate}%`,
      sub: 'Closed in single exchange',
      icon: Sparkles,
      color: 'text-teal-700 dark:text-teal-300',
      bg: 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
    },
    {
      title: 'Active Agents Online',
      value: `${summary.activeOnline} / ${summary.totalAgents}`,
      sub: `${summary.activePending} chats awaiting reply`,
      icon: UserCheck,
      color: 'text-indigo-700 dark:text-indigo-300',
      bg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Speed Metrics */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {teamCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="dashboard-card relative flex flex-col justify-between p-4 transition hover:border-whatsapp-500/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                  {card.title}
                </span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.bg}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>

              <div className="mt-3">
                <p className={`text-2xl font-black tabular-nums tracking-tight ${card.color}`}>
                  {card.value}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-theme-muted truncate">
                  {card.sub}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 7x24 Peak Hours Heatmap */}
      <div className="dashboard-card p-5">
        <PeakHoursHeatmap cells={heatmapCells} />
      </div>

      {/* Unified Agent Performance Scorecard */}
      <UnifiedAgentScorecardTable
        agents={agentScorecards}
        periodDays={teamData.dayCount}
        onExportCsv={onExportCsv}
      />
    </div>
  );
}
