import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { triggerMeta } from './flowMeta';
import type { TriggerNodeData } from './flowGraphUtils';
import { FlowHandle } from './FlowHandle';

function TriggerNodeComponent({ data }: NodeProps) {
  const { triggerType, triggerLabel, triggerDetail } = data as TriggerNodeData;
  const meta = triggerMeta[triggerType];
  const Icon = meta?.icon || Zap;

  return (
    <div
      className="min-w-[240px] overflow-visible rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-purple-50/50"
      style={{ boxShadow: '0 4px 20px rgba(124,58,237,0.12), 0 0 0 1px rgba(139,92,246,0.08)' }}
    >
      <div className="h-1 rounded-t-2xl bg-gradient-to-r from-violet-600 to-purple-700" />

      <div className="flex items-center gap-3 px-4 py-3.5">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta?.gradient || 'from-violet-600 to-purple-700'} text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)]`}
        >
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">When this happens</p>
          <p className="truncate text-[14px] font-extrabold text-slate-900">{triggerLabel}</p>
          <p className="truncate text-[11px] text-slate-500">{triggerDetail}</p>
        </div>
      </div>

      <div className="relative flex justify-center border-t border-violet-100/80 py-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-violet-400">Connect to first step</span>
        <FlowHandle type="source" id="start" variant="trigger" />
      </div>
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
