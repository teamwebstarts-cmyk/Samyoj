import { type NodeProps } from '@xyflow/react';
import { nodeMeta } from './flowMeta';
import { getNodeHandles, type FlowStepNodeData } from './flowGraphUtils';
import { FlowHandle, branchHandleLeft } from './FlowHandle';

function FlowStepNodeComponent({ data, selected }: NodeProps) {
  const { flowNode, label, summary, index } = data as FlowStepNodeData;
  const meta = nodeMeta[flowNode.type];
  const Icon = meta.icon;
  const handles = getNodeHandles(flowNode);
  const isBranching = handles.length > 1 || flowNode.type === 'buttons';

  return (
    <div
      className={`flow-step-card group/node min-w-[228px] max-w-[260px] overflow-visible rounded-2xl border bg-white transition-all duration-200 ${
        selected
          ? 'border-emerald-400'
          : 'border-slate-200/90 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50'
      }`}
      style={{
        boxShadow: selected
          ? '0 0 0 3px rgba(74,222,128,0.18), 0 12px 28px rgba(37,211,102,0.14)'
          : '0 4px 16px rgba(15,23,42,0.06)',
      }}
    >
      <FlowHandle type="target" id="in" variant="target" />

      {/* Header accent */}
      <div className={`h-1 rounded-t-2xl bg-gradient-to-r ${meta.gradient}`} />

      <div className="flex items-start gap-3 px-3.5 pb-2 pt-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.gradient} text-white shadow-sm`}
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-2">
            <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-slate-100 px-1 text-[10px] font-extrabold tabular-nums text-slate-500">
              {index + 1}
            </span>
            <span className={`text-[13px] font-extrabold leading-tight ${meta.color}`}>{label}</span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{summary}</p>
        </div>
      </div>

      {isBranching ? (
        <div className="relative border-t border-slate-100 bg-slate-50/60 px-2 pb-3 pt-2">
          <p className="mb-1.5 text-center text-[9px] font-bold uppercase tracking-wider text-slate-400">
            Drag from a path
          </p>
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${handles.length}, minmax(0, 1fr))` }}
          >
            {handles.map((h) => (
              <div key={h.id} className="flex flex-col items-center gap-1 px-0.5">
                <span className="max-w-full truncate rounded-lg bg-white px-2 py-1 text-center text-[10px] font-bold text-slate-600 ring-1 ring-slate-200/80">
                  {h.label}
                </span>
              </div>
            ))}
          </div>
          {handles.map((h, i) => (
            <FlowHandle
              key={h.id}
              type="source"
              id={h.id}
              variant="branch"
              style={branchHandleLeft(i, handles.length)}
            />
          ))}
        </div>
      ) : (
        <div className="relative flex justify-center border-t border-slate-100 bg-slate-50/40 py-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
            Drag to connect
          </span>
          <FlowHandle type="source" id="next" variant="source" />
        </div>
      )}
    </div>
  );
}

export const FlowStepNode = FlowStepNodeComponent;
