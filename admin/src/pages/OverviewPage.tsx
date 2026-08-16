import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { platformRequest } from '../api';
import { LifecycleRail } from '../components/LifecycleRail';
import { EmptyState, FlagPills, Notice } from '../components/ui';
import { formatCount } from '../lib/format';
import type { ActivationStage } from '../lib/stages';
import type { HealthFlags } from '../types';
import { Inbox } from 'lucide-react';

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

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p className="text-sm text-ink/55">Loading overview…</p>;

  const counts = Object.fromEntries(data.funnel.map((row) => [row.stage, row.count])) as Record<
    ActivationStage,
    number
  >;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Where orgs stall</h1>
        <p className="mt-1 text-sm text-ink/60">
          {formatCount(data.orgCount)} organizations. The rail is activation. Flags sit beside it.
        </p>
      </div>
      <div className="rounded-2xl border border-dust bg-white p-5">
        <LifecycleRail counts={counts} onSelect={(stage) => navigate(`/accounts?stage=${stage}`)} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-dust bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink/45">AI tokens this month</p>
          <p className="mt-2 font-mono text-2xl">{formatCount(data.aiTokensMonth)}</p>
          <p className="mt-2 text-xs text-ink/50">{data.coverageNote}</p>
        </div>
        <div className="rounded-2xl border border-dust bg-white p-4 md:col-span-2">
          <p className="text-xs uppercase tracking-wide text-ink/45">Meta errors this week</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.metaErrors.length === 0 && <p className="text-sm text-ink/50">No clustered codes yet.</p>}
            {data.metaErrors.map((row) => (
              <button
                key={row.code}
                type="button"
                className="rounded-lg border border-dust px-3 py-2 text-left hover:bg-sage-faint"
                onClick={() => navigate('/errors')}
              >
                <span className="font-mono text-sm">{row.code}</span>
                <span className="ml-2 text-xs text-ink/50">{row.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <section>
        <h2 className="text-lg font-semibold">Needs a human</h2>
        {data.needsAttention.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon={Inbox} title="Queue is clear" description="No stalled or at-risk orgs in today’s snapshot." />
          </div>
        ) : (
          <div className="mt-3 divide-y divide-dust overflow-hidden rounded-2xl border border-dust bg-white">
            {data.needsAttention.map((row) => (
              <button
                key={row.organizationId}
                type="button"
                className="flex w-full flex-col gap-2 px-4 py-3 text-left md:flex-row md:items-center md:justify-between"
                onClick={() => navigate(`/accounts/${row.organizationId}`)}
              >
                <div>
                  <p className="font-semibold">{row.companyName}</p>
                  <p className="font-mono text-xs text-ink/50">{row.stage}</p>
                </div>
                <FlagPills flags={row.flags} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
