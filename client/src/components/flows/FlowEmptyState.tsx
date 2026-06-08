import { GitBranch, HelpCircle, MessageSquare } from 'lucide-react';
import type { FlowNodeType } from '../../types';
import { nodeMeta } from './flowMeta';

const quickStarts: Array<{ type: FlowNodeType; hint: string }> = [
  { type: 'message', hint: 'Send a welcome text' },
  { type: 'buttons', hint: 'Offer menu choices' },
  { type: 'question', hint: 'Collect customer info' },
];

interface FlowEmptyStateProps {
  onAdd: (type: FlowNodeType) => void;
  compact?: boolean;
}

export default function FlowEmptyState({ onAdd, compact }: FlowEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'px-4 py-10' : 'px-6 py-14 sm:py-20'
      }`}
    >
      <div className="relative">
        <div className="absolute -inset-6 rounded-full bg-gradient-to-br from-violet-100/80 via-emerald-50/60 to-transparent blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-emerald-500 text-white shadow-[0_16px_48px_rgba(99,102,241,0.25)]">
          <GitBranch className="h-9 w-9" strokeWidth={1.75} />
        </div>
      </div>

      <h2 className="mt-8 text-[20px] font-extrabold tracking-tight text-neutral-900 sm:text-[22px]">
        Build your first step
      </h2>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-neutral-500">
        Start with a message, menu buttons, or a question. You can add more steps anytime.
      </p>

      <div className="mt-8 grid w-full max-w-md gap-3 sm:grid-cols-3">
        {quickStarts.map(({ type, hint }) => {
          const meta = nodeMeta[type];
          const Icon = type === 'message' ? MessageSquare : type === 'question' ? HelpCircle : meta.icon;

          return (
            <button
              key={type}
              type="button"
              onClick={() => onAdd(type)}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-neutral-200/70 bg-white px-4 py-5 shadow-sm transition hover:border-whatsapp-200 hover:shadow-md active:scale-[0.98]"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.gradient} text-white shadow-md transition group-hover:scale-105`}
              >
                <Icon className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-[13px] font-extrabold text-neutral-900">{meta.label}</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">{hint}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
