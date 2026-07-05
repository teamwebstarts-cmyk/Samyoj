import { MessageSquare, Smartphone } from 'lucide-react';
import FlowPhoneMockup from './FlowPhoneMockup';
import type { FlowNode } from '../../types';

interface FlowPreviewPanelProps {
  nodes: FlowNode[];
  startNodeId?: string;
  flowName?: string;
}

export default function FlowPreviewPanel({ nodes, startNodeId, flowName }: FlowPreviewPanelProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-violet-200/80 bg-gradient-to-br from-violet-50/40 to-white px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_8px_24px_rgba(99,102,241,0.25)]">
          <Smartphone className="h-7 w-7" strokeWidth={2} />
        </div>
        <p className="mt-4 text-[15px] font-extrabold text-neutral-900">Nothing to preview yet</p>
        <p className="mt-1.5 max-w-[240px] text-[12px] font-medium leading-relaxed text-neutral-500">
          Add at least one step on the left — your messages will show here exactly as customers see them on WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-emerald-100/80 bg-gradient-to-r from-emerald-50/60 to-white px-3.5 py-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <MessageSquare className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-neutral-900">
              {flowName?.trim() ? `"${flowName.trim()}" on WhatsApp` : 'How customers will see it'}
            </p>
            <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-neutral-500">
              This walks through your flow from start to finish. Buttons and menus auto-pick the first option.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-1">
        <FlowPhoneMockup nodes={nodes} startNodeId={startNodeId} />
      </div>
    </div>
  );
}
