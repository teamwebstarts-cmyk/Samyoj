import { useEffect, useState } from 'react';
import { BarChart3, CheckCircle, Play, UserX } from 'lucide-react';
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
  return status;
}

export default function FlowAnalyticsPanel({ flowId, nodes }: FlowAnalyticsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    stats: FlowStats;
    completionRate: number;
    nodeRuns: { success: number; failed: number };
    recentRuns: Array<{ action: string; status: string; createdAt: string }>;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    flowApi
      .analytics(flowId)
      .then(({ data: res }) => setData(res.data))
      .catch((err) => {
        toastError(getErrorMessage(err, 'Failed to load stats'));
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [flowId]);

  if (loading) return <LoadingState label="Loading stats..." />;
  if (!data) return <p className="text-[13px] text-neutral-500">No stats yet.</p>;

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
