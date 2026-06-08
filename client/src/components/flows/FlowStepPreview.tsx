import { WhatsAppMessagePreview } from '../inbox/WhatsAppPreview';
import type { FlowNode } from '../../types';

interface FlowStepPreviewProps {
  node: FlowNode | null;
}

export default function FlowStepPreview({ node }: FlowStepPreviewProps) {
  if (!node) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/80 p-6 text-center">
        <p className="text-[13px] font-medium text-neutral-500">
          Select a step to preview how it looks on WhatsApp
        </p>
      </div>
    );
  }

  const text =
    node.type === 'question'
      ? node.prompt || node.text || ''
      : node.text || node.prompt || '';

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
        WhatsApp preview
      </p>
      <div className="rounded-2xl border border-neutral-200/80 bg-[#e5ddd5] p-4 shadow-panel">
        {text && <WhatsAppMessagePreview content={text} direction="outbound" />}
        {node.type === 'buttons' && node.buttons && node.buttons.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {node.buttons.map((btn) => (
              <div
                key={btn.id}
                className="rounded-lg bg-white px-3 py-2 text-center text-[12px] font-semibold text-[#00a5f4] shadow-sm"
              >
                {btn.title}
              </div>
            ))}
          </div>
        )}
        {node.type === 'tag' && (
          <div className="mt-2 flex justify-end">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">
              +{node.tag}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
