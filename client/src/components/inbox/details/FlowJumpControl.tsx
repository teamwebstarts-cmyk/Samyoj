import { useEffect, useState } from 'react';
import AppButton from '../../ui/AppButton';
import AppSelect from '../../ui/AppSelect';
import { flowApi, inboxApi } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { toastError, toastSuccess } from '../../../utils/toast';
import { nodeMeta } from '../../flows/flowMeta';
import type { ActiveFlowInfo, FlowNode } from '../../../types';

interface FlowJumpControlProps {
  conversationId: string;
  activeFlow: ActiveFlowInfo;
  onJumped?: () => void;
}

export default function FlowJumpControl({ conversationId, activeFlow, onJumped }: FlowJumpControlProps) {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [nodeId, setNodeId] = useState(activeFlow.currentNodeId);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    flowApi
      .get(activeFlow.flowId)
      .then(({ data }) => {
        if (cancelled) return;
        const flowNodes = (data.data.draftNodes ?? data.data.nodes ?? []) as FlowNode[];
        setNodes(flowNodes);
      })
      .catch(() => {
        if (!cancelled) setNodes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeFlow.flowId]);

  const options = nodes.map((node, index) => ({
    value: node.id,
    label: `${index + 1}. ${nodeMeta[node.type]?.label || node.type}`,
  }));

  const jump = async () => {
    if (!nodeId) return;
    setLoading(true);
    try {
      await inboxApi.jumpFlow(conversationId, nodeId);
      toastSuccess('Customer moved to the selected step');
      onJumped?.();
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not jump to that step'));
    } finally {
      setLoading(false);
    }
  };

  if (!options.length) return null;

  return (
    <div className="space-y-2 rounded-xl bg-theme-subtle/40 px-3 py-2.5 ring-1 ring-theme-border/60">
      <p className="text-[11px] font-semibold text-theme-muted">Advance customer to step</p>
      <AppSelect
        label=""
        value={nodeId}
        onChange={(e) => setNodeId(e.target.value)}
        options={options}
      />
      <AppButton size="sm" variant="secondary" loading={loading} onClick={jump}>
        Jump to step
      </AppButton>
    </div>
  );
}
