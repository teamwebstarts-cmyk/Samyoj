import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { platformRequest } from '../api';
import { LifecycleRail } from '../components/LifecycleRail';
import {
  EmptyState,
  FlagPills,
  Notice,
  PageHeader,
  PageLoading,
  SectionCard,
} from '../components/ui';
import { formatAiCapPercent, formatCount } from '../lib/format';
import { STAGE_LABELS, type ActivationStage } from '../lib/stages';
import type { HealthFlags } from '../types';

type Overview = {
  orgCount: number;
  funnel: Array<{ stage: ActivationStage; count: number }>;
  needsAttention: Array<{
    organizationId: string;
    companyName: string;
    stage: ActivationStage;
    lastLoginAt: string | null;
    flags: HealthFlags;
  }>;
  metaErrors: Array<{ code: number; count: number }>;
  aiTokensMonth: number;
  aiCap?: {
    tokenLimitSum: number | null;
    cappedOrgCount: number;
    uncappedOrgCount: number;
  };
  topAiOrgs?: Array<{
    organizationId: string;
    companyName: string;
    aiTokensMonth: number;
    monthlyTokenLimit: number | null;
  }>;
  coverageNote: string;
};

export function OverviewPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    platformRequest<Overview>('/overview')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  if (error) {
    return (
      <Notice tone="error">
        Could not load overview. {error} Refresh, or confirm you are still signed in.
      </Notice>
    );
  }
  if (!data) return <PageLoading label="Loading overview…" />;

  const counts = Object.fromEntries(data.funnel.map((row) => [row.stage, row.count])) as Record<
    ActivationStage,
    number
  >;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overview"
        purpose={`${formatCount(data.orgCount)} organizations. The rail is activation — click a station to open those accounts.`}
      />

      <SectionCard
        title="Activation"
        purpose="REGISTERED → Connect → contacts → outbound → live inbox"
        padded
      >
        <LifecycleRail
          counts={counts}
          onSelect={(stage) => navigate(`/accounts?stage=${stage}`)}
        />
      </SectionCard>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(14rem,0.8fr)]">
        <SectionCard
          title="Needs a human"
          purpose="Stalled or at-risk orgs from today’s snapshot. Open the file, then email the owner if needed."
        >
          {data.needsAttention.length === 0 ? (
            <div className="p-[var(--card-pad)]">
              <EmptyState
                icon={Inbox}
                title="Queue is clear"
                description="No stalled or at-risk orgs in today’s snapshot. Use the rail if you still need to inspect a stage."
              />
            </div>
          ) : (
            <ul className="divide-y divide-dust">
              {data.needsAttention.map((row) => (
                <li key={row.organizationId}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1.5 px-3 py-2.5 text-left hover:bg-sage-faint/60 md:flex-row md:items-center md:justify-between"
                    onClick={() => navigate(`/accounts/${row.organizationId}`)}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{row.companyName}</p>
                      <p className="text-xs text-ink/50">{STAGE_LABELS[row.stage]}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <FlagPills flags={row.flags} />
                      <span className="text-xs font-semibold text-sage">Open</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Meta errors this week" purpose="Official codes only. Open the Errors queue.">
            <div className="p-[var(--card-pad)]">
              {data.metaErrors.length === 0 ? (
                <p className="text-sm text-ink/50">No clustered codes yet. Failed sends aggregate here.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.metaErrors.map((row) => (
                    <button
                      key={row.code}
                      type="button"
                      className="rounded-lg border border-dust px-2.5 py-1.5 text-left hover:bg-sage-faint"
                      onClick={() => navigate('/errors')}
                    >
                      <span className="font-mono text-sm">{row.code}</span>
                      <span className="ml-2 text-xs text-ink/50">{formatCount(row.count)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="AI this month"
            purpose={
              data.aiCap?.tokenLimitSum != null
                ? `${data.aiCap.cappedOrgCount} orgs with a cap${
                    data.aiCap.uncappedOrgCount ? ` · ${data.aiCap.uncappedOrgCount} uncapped` : ''
                  }`
                : 'No org token caps are set.'
            }
          >
            <div className="space-y-2.5 p-[var(--card-pad)]">
              <p className="text-sm text-ink/80">
                {data.aiCap?.tokenLimitSum != null
                  ? `${formatCount(data.aiTokensMonth)} / ${formatCount(data.aiCap.tokenLimitSum)} tokens`
                  : `${formatCount(data.aiTokensMonth)} tokens · no platform cap`}
              </p>
              <p className="text-xs text-ink/50">{data.coverageNote}</p>
              {(data.topAiOrgs || []).length > 0 && (
                <ul className="divide-y divide-dust rounded-xl border border-dust">
                  {data.topAiOrgs!.map((row) => (
                    <li key={row.organizationId}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-sage-faint/60"
                        onClick={() => navigate(`/accounts/${row.organizationId}?tab=ai`)}
                      >
                        <span className="truncate font-medium">{row.companyName}</span>
                        <span className="shrink-0 font-mono text-xs text-ink/55">
                          {formatAiCapPercent(row.aiTokensMonth, row.monthlyTokenLimit)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
