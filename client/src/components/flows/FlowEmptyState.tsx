import { GitBranch, HelpCircle, MessageSquare } from 'lucide-react';
import type { FlowNodeType } from '../../types';
import { nodeMeta } from './flowMeta';

const quickStarts: Array<{ type: FlowNodeType; hint: string }> = [
  { type: 'message', hint: 'Say hello to your customer' },
  { type: 'buttons', hint: 'Let them pick an option' },
  { type: 'question', hint: 'Ask for their name or email' },
];

interface FlowEmptyStateProps {
  onAdd: (type: FlowNodeType) => void;
  compact?: boolean;
}

export default function FlowEmptyState({ onAdd, compact }: FlowEmptyStateProps) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden text-center ${
        compact ? 'px-4 py-10' : 'px-6 py-14 sm:py-20'
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(37,211,102,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(37,211,102,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-50"
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-10 top-0 h-36 w-36 rounded-full bg-gradient-to-br from-violet-400/12 via-emerald-400/8 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 rounded-full bg-gradient-to-tl from-whatsapp-500/10 to-transparent blur-3xl" />

      <div className="relative">
        <div className="absolute -inset-6 rounded-full bg-gradient-to-br from-violet-400/15 via-emerald-300/10 to-transparent blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-violet-500 to-emerald-500 text-white shadow-[0_16px_48px_rgba(99,102,241,0.22)] ring-1 ring-white/20">
          <GitBranch className="h-9 w-9" strokeWidth={1.75} />
        </div>
      </div>

      <h2 className="empty-lead relative mt-8 text-theme-fg">
        Start with one step
      </h2>
      <p className="relative mt-2 max-w-sm text-[14px] leading-relaxed text-theme-secondary">
        Tap any option below. You can add more steps anytime — no coding needed.
      </p>

      <div className="relative mt-8 grid w-full max-w-lg gap-3 sm:grid-cols-3">
        {quickStarts.map(({ type, hint }) => {
          const meta = nodeMeta[type];
          const Icon = type === 'message' ? MessageSquare : type === 'question' ? HelpCircle : meta.icon;

          return (
            <button
              key={type}
              type="button"
              onClick={() => onAdd(type)}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-theme-border/70 bg-theme-surface/90 px-4 py-5 shadow-sm transition hover:border-whatsapp-300/60 hover:shadow-md active:scale-[0.98] dark:hover:border-whatsapp-500/30"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.gradient} text-white shadow-md transition group-hover:scale-105`}
              >
                <Icon className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-[13px] font-extrabold text-theme-fg">{meta.label}</p>
                <p className="mt-0.5 text-[11px] font-medium text-theme-muted">{hint}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
