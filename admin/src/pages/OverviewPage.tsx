import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertOctagon,
  Building2,
  Cpu,
  Inbox,
  ArrowRight,
} from 'lucide-react';
import { platformRequest } from '../api';
import { LifecycleRail } from '../components/LifecycleRail';
import {
  Button,
  EmptyState,
  FlagPills,
  Notice,
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
  if (!data) return <PageLoading label="Loading platform dashboard…" />;

  const counts = Object.fromEntries(data.funnel.map((row) => [row.stage, row.count])) as Record<
    ActivationStage,
    number
  >;

  const liveCount = counts['LIVE'] ?? 0;
  const connectedCount = (counts['CONNECTED_EMPTY'] ?? 0) + (counts['CONTACTS_READY'] ?? 0) + (counts['OUTBOUND_ONLY'] ?? 0) + liveCount;
  const totalMetaErrors = data.metaErrors.reduce((acc, row) => acc + row.count, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dashboard-card relative overflow-hidden p-4 bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Organizations</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{formatCount(data.orgCount)}</p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium text-indigo-600">{formatCount(liveCount)} live</span>
            <span>· across all tiers</span>
          </div>
        </div>

        <div className="dashboard-card relative overflow-hidden p-4 bg-gradient-to-br from-white to-indigo-50/40">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Connected Numbers</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100/80 text-indigo-800">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-indigo-950">{formatCount(connectedCount)}</p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium text-indigo-600">Active WABA</span>
            <span>in production</span>
          </div>
        </div>

        <div className="dashboard-card relative overflow-hidden p-4 bg-gradient-to-br from-white to-sky-50/40">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">AI Tokens (30d)</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100/80 text-sky-800">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 font-mono">{formatCount(data.aiTokensMonth)}</p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <span>{data.aiCap?.cappedOrgCount ?? 0} orgs with custom cap</span>
          </div>
        </div>

        <div className="dashboard-card relative overflow-hidden p-4 bg-gradient-to-br from-white to-rose-50/30">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Meta Error Incidents</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100/80 text-rose-800">
              <AlertOctagon className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-rose-950">{formatCount(totalMetaErrors)}</p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium text-rose-700">{data.metaErrors.length} unique codes</span>
            <span>this week</span>
          </div>
        </div>
      </div>

      {/* Activation Lifecycle Rail */}
      <SectionCard
        title="Activation Lifecycle & Conversion Funnel"
        purpose="Live tracking of organizations from initial registration to active WhatsApp live inbox."
        action={
          <Button variant="secondary" size="sm" onClick={() => navigate('/accounts')}>
            View all accounts <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        }
        padded
      >
        <div className="py-2">
          <LifecycleRail
            counts={counts}
            showHints
            onSelect={(stage) => navigate(`/accounts?stage=${stage}`)}
          />
        </div>
      </SectionCard>

      {/* Grid: Needs Attention vs Right Column Analytics */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.9fr)]">
        {/* Needs Attention Queue */}
        <SectionCard
          title="Needs Operator Attention"
          purpose="Stalled setups or flagged organizations requiring triage or outreach."
        >
          {data.needsAttention.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Inbox}
                title="All queues clear"
                description="No stalled or at-risk organizations detected in today’s health snapshot."
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-200/80">
              {data.needsAttention.map((row) => (
                <li key={row.organizationId}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-2 p-4 text-left hover:bg-indigo-50/40 transition-colors sm:flex-row sm:items-center sm:justify-between group"
                    onClick={() => navigate(`/accounts/${row.organizationId}`)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 group-hover:text-indigo-800 transition-colors">{row.companyName}</p>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {STAGE_LABELS[row.stage]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Last seen {row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleDateString() : 'never'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <FlagPills flags={row.flags} />
                      <span className="inline-flex items-center text-xs font-semibold text-indigo-700 group-hover:translate-x-0.5 transition-transform">
                        Inspect <ArrowRight className="h-3 w-3 ml-1" />
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Right Side: Meta Errors & AI Token Leaders */}
        <div className="space-y-6">
          {/* Meta Errors */}
          <SectionCard
            title="Meta Error Clusters"
            purpose="Official Meta WhatsApp API error codes logged in the last 7 days."
            action={
              <button
                type="button"
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-800"
                onClick={() => navigate('/errors')}
              >
                Inspect All →
              </button>
            }
          >
            <div className="p-4">
              {data.metaErrors.length === 0 ? (
                <p className="text-xs text-slate-400">Zero Meta error codes recorded in this window.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {data.metaErrors.map((row) => (
                    <button
                      key={row.code}
                      type="button"
                      className="flex flex-col items-start rounded-xl border border-slate-200/90 bg-white p-2.5 text-left hover:border-indigo-500/40 hover:bg-indigo-50/30 transition-all shadow-2xs"
                      onClick={() => navigate('/errors')}
                    >
                      <span className="font-mono text-xs font-bold text-slate-900">{row.code}</span>
                      <span className="mt-1 text-[11px] font-medium text-rose-700">{formatCount(row.count)} errors</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          {/* AI Usage Consumption Leaders */}
          <SectionCard
            title="AI Consumption Leaders"
            purpose={
              data.aiCap?.tokenLimitSum != null
                ? `${formatCount(data.aiTokensMonth)} / ${formatCount(data.aiCap.tokenLimitSum)} tokens total`
                : `${formatCount(data.aiTokensMonth)} tokens billed`
            }
          >
            <div className="p-4 space-y-3">
              {(data.topAiOrgs || []).length === 0 ? (
                <p className="text-xs text-slate-400">No token activity recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.topAiOrgs!.map((row) => (
                    <li key={row.organizationId}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-2.5 text-left text-xs hover:border-indigo-500/40 hover:bg-indigo-50/30 transition-all shadow-2xs"
                        onClick={() => navigate(`/accounts/${row.organizationId}?tab=ai`)}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{row.companyName}</p>
                          <p className="text-[11px] font-mono text-slate-500">{formatCount(row.aiTokensMonth)} tokens</p>
                        </div>
                        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-bold text-slate-700">
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
