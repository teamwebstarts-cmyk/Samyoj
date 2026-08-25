import { useEffect, useState } from 'react';
import { BarChart3, CheckCircle, Play, UserX } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import LoadingState from '../ui/LoadingState';
import { flowApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { toastError } from '../../utils/toast';
import type { FlowNode, FlowStats } from '../../types';
import { nodeMeta } from './flowMeta';

interface FlowAnalyticsPanelProps {
  flowId: string;
  nodes?: FlowNode[];
}

function stepLabel(nodes: FlowNode[] | undefined, nodeId: string): string {
  if (!nodes?.length) return nodeId;
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return nodeId;
  const idx = nodes.indexOf(node);
  return `${idx + 1}. ${nodeMeta[node.type]?.label || node.type}`;
}

function statusLabel(status: string): string {
  if (status === 'success') return 'Worked';
  if (status === 'failed') return "Didn't work";
  if (status === 'skipped') return 'Not sent';
  return status;
}

const SKIP_REASON_LABELS: Record<string, string> = {
  csw_closed: '24h window closed',
  frequency_cap: 'Sent recently (24h cap)',
  inbound_during_wait: 'Customer replied during wait',
  bot_paused: 'Automations paused',
  opt_out: 'Customer opted out',
  other: 'Other skip',
};

export default function FlowAnalyticsPanel({ flowId, nodes }: FlowAnalyticsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    stats: FlowStats;
    completionRate: number;
    nodeRuns: { success: number; failed: number };
    bySkipReason?: Record<string, number>;
    recentRuns: Array<{ action: string; status: string; createdAt: string }>;
  } | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    flowApi
      .analytics(flowId)
      .then(({ data: res }) => setData(res.data))
      .catch((err) => {
        const message = getErrorMessage(err, 'Failed to load stats');
        setError(message);
        setData(null);
        toastError(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [flowId]);

  if (loading) return <LoadingState label="Loading stats..." />;
  if (error) {
    return (
      <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/60 p-4 text-center">
        <p className="text-sm font-semibold text-red-800">Could not load analytics</p>
        <p className="text-xs text-red-700">{error}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <EmptyState
        icon={BarChart3}
        compact
        title="No stats yet"
        description="Numbers appear once customers start going through this flow."
        steps={['Turn the flow on', 'Share your WhatsApp number with customers', 'Check back here for completion rates']}
      />
    );
  }

  const stats = [
    { label: 'Started', value: data.stats.starts, icon: Play, color: 'text-sky-600' },
    { label: 'Finished', value: data.stats.completions, icon: CheckCircle, color: 'text-emerald-600' },
    { label: 'Passed to team', value: data.stats.handoffs, icon: UserX, color: 'text-amber-600' },
    { label: 'Finish rate', value: `${data.completionRate}%`, icon: BarChart3, color: 'text-violet-600' },
  ];

  return (
    <div className="min-w-0 space-y-5">
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="min-w-0 rounded-xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50/80 p-3"
          >
            <s.icon className={`h-4 w-4 ${s.color}`} />
            <p className="mt-2 truncate text-lg font-extrabold text-neutral-900 sm:text-xl">{s.value}</p>
            <p className="truncate text-[10px] font-semibold text-neutral-500 sm:text-[11px]">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-neutral-100 p-3">
        <p className="text-[12px] font-bold text-neutral-700">Steps completed</p>
        <p className="mt-1 text-[13px] text-neutral-600">
          {data.nodeRuns.success} worked · {data.nodeRuns.failed} didn't work
        </p>
      </div>

      {data.bySkipReason && Object.keys(data.bySkipReason).length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
          <p className="text-[12px] font-bold text-neutral-700">Why steps were skipped</p>
          <div className="mt-2 space-y-1">
            {Object.entries(data.bySkipReason).map(([reason, count]) => (
              <div key={reason} className="flex justify-between text-[12px] text-neutral-600">
                <span>{SKIP_REASON_LABELS[reason] || reason.replace(/_/g, ' ')}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(data.stats.dropoffs || {}).length > 0 && (
        <div>
          <p className="mb-2 text-[12px] font-bold text-neutral-700">Where people stopped</p>
          <div className="space-y-1">
            {Object.entries(data.stats.dropoffs).map(([nodeId, count]) => (
              <div key={nodeId} className="flex justify-between text-[12px] text-neutral-600">
                <span className="truncate">{stepLabel(nodes, nodeId)}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.recentRuns.length > 0 && (
        <div>
          <p className="mb-2 text-[12px] font-bold text-neutral-700">Recent activity</p>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {data.recentRuns.slice(0, 10).map((run, i) => (
              <div key={i} className="flex justify-between text-[11px] text-neutral-500">
                <span className="truncate">{run.action}</span>
                <span className={run.status === 'success' ? 'text-emerald-600' : 'text-red-500'}>
                  {statusLabel(run.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
