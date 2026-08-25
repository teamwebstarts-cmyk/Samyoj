import { useEffect, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import AppButton from '../ui/AppButton';
import LoadingState from '../ui/LoadingState';
import { flowApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { toastError } from '../../utils/toast';
import type { FlowNode } from '../../types';

interface FlowVersion {
  version: number;
  note?: string | null;
  createdAt: string;
  triggerType: string;
}

interface FlowVersionsPanelProps {
  flowId: string;
  onRestore: (
    flow: {
      nodes: FlowNode[];
      startNodeId?: string | null;
      triggerType?: string;
      triggerConfig?: Record<string, unknown>;
      enabled?: boolean;
      priority?: number;
      updatedAt?: string;
    },
    version: number
  ) => void;
}

export default function FlowVersionsPanel({ flowId, onRestore }: FlowVersionsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [versions, setVersions] = useState<FlowVersion[]>([]);

  const load = () => {
    setLoading(true);
    flowApi
      .versions(flowId)
      .then(({ data }) => setVersions(data.data.versions || []))
      .catch((err) => toastError(getErrorMessage(err, 'Failed to load versions')))
      .finally(() => setLoading(false));
  };

  useEffect(load, [flowId]);

  const handleRestore = async (version: number) => {
    if (
      !window.confirm(
        `Restore version ${version} into your draft? Live customer behavior will not change until you publish.`
      )
    ) {
      return;
    }
    setRestoring(version);
    try {
      const { data } = await flowApi.restoreVersion(flowId, version);
      const flow = (data.data.flow || data.data) as {
        nodes?: FlowNode[];
        startNodeId?: string | null;
        triggerType?: string;
        triggerConfig?: Record<string, unknown>;
        enabled?: boolean;
        priority?: number;
        updatedAt?: string;
      };
      onRestore({ ...flow, nodes: flow.nodes || [] }, version);
      load();
    } catch (err) {
      toastError(getErrorMessage(err, 'Failed to restore version'));
    } finally {
      setRestoring(null);
    }
  };

  if (loading) return <LoadingState label="Loading version history..." />;

  if (versions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center">
        <History className="mx-auto h-8 w-8 text-neutral-300" />
        <p className="mt-2 text-[13px] font-medium text-neutral-500">No published versions yet</p>
        <p className="mt-1 text-[12px] text-neutral-400">Publish your flow to create version snapshots</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-neutral-500">{versions.length} version{versions.length === 1 ? '' : 's'}</p>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {versions.map((v) => (
          <div
            key={v.version}
            className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/50 px-3 py-2.5"
          >
            <div>
              <p className="text-[13px] font-bold text-neutral-800">v{v.version}</p>
              <p className="text-[11px] text-neutral-500">
                {new Date(v.createdAt).toLocaleString()}
                {v.note ? ` · ${v.note}` : ''}
              </p>
            </div>
            <AppButton
              size="sm"
              variant="secondary"
              icon={<RotateCcw size={13} />}
              loading={restoring === v.version}
              onClick={() => handleRestore(v.version)}
            >
              Restore
            </AppButton>
          </div>
        ))}
      </div>
    </div>
  );
}
