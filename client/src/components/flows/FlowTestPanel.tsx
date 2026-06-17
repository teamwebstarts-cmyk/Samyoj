import { useState } from 'react';
import { Play } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import { flowApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { toastError, toastSuccess, toastWarning } from '../../utils/toast';
import type { FlowNode, FlowTriggerType } from '../../types';
import { nodeMeta } from './flowMeta';

interface FlowTestPanelProps {
  triggerType: FlowTriggerType;
  triggerConfig: Record<string, unknown>;
  nodes: FlowNode[];
  startNodeId?: string;
}

function stepTypeLabel(type: string): string {
  return nodeMeta[type as keyof typeof nodeMeta]?.label || type.replace(/_/g, ' ');
}

export default function FlowTestPanel({ triggerType, triggerConfig, nodes, startNodeId }: FlowTestPanelProps) {
  const [message, setMessage] = useState('hello');
  const [isNew, setIsNew] = useState(false);
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    triggered: boolean;
    reason: string;
    steps: Array<{ nodeId: string; type: string; action: string; branch?: string }>;
  } | null>(null);

  const runTest = async () => {
    if (!nodes.length) {
      toastWarning('Add at least one step before trying it out');
      return;
    }

    setLoading(true);
    try {
      const { data } = await flowApi.simulate({
        triggerType,
        triggerConfig,
        nodes,
        startNodeId,
        message,
        isNewConversation: isNew,
        contactTags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      const sim = data.data;
      setResult(sim);

      if (sim.triggered) {
        toastSuccess(`Would start — ${sim.steps.length} step(s) tested`);
      } else {
        toastWarning(sim.reason || 'Would not start for this message');
      }
    } catch (err: unknown) {
      setResult({ triggered: false, reason: 'Test failed', steps: [] });
      toastError(getErrorMessage(err, 'Test failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <AppInput label="Sample customer message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="hello" />
      <AppInput
        label="Contact tags (optional)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="vip, lead"
        hint="Separate with commas"
      />
      <label className="flex items-center gap-2 text-[13px] font-medium text-neutral-700">
        <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} className="rounded" />
        Treat as their first message
      </label>

      <AppButton size="sm" icon={<Play size={14} />} loading={loading} onClick={runTest}>
        Try it out
      </AppButton>

      {result && (
        <div className={`rounded-xl border p-3 ${result.triggered ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className={`text-[13px] font-bold ${result.triggered ? 'text-emerald-800' : 'text-amber-800'}`}>
            {result.triggered ? '✓ Would start' : '✗ Would not start'}
          </p>
          <p className="mt-1 text-[12px] text-neutral-600">{result.reason}</p>
          {result.steps.length > 0 && (
            <div className="mt-3 space-y-1">
              {result.steps.map((step, i) => (
                <div key={i} className="rounded-lg bg-white/80 px-2 py-1.5 text-[11px] text-neutral-700">
                  <span className="font-bold">{i + 1}.</span> {stepTypeLabel(step.type)} — {step.action}
                  {step.branch && <span className="ml-1 text-violet-600">→ {step.branch}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
