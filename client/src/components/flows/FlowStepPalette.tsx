import type { FlowNodeType } from '../../types';
import { nodeMeta } from './flowMeta';
import { NODE_CATEGORIES } from './flowUtils';

interface FlowStepPaletteProps {
  onAdd: (type: FlowNodeType) => void;
  variant?: 'sidebar' | 'horizontal';
  /** Hide the intro card when the parent aside already has a section header. */
  hideIntro?: boolean;
}

export default function FlowStepPalette({
  onAdd,
  variant = 'sidebar',
  hideIntro = false,
}: FlowStepPaletteProps) {
  if (variant === 'horizontal') {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white px-3 py-3 shadow-sm">
        <p className="mb-2.5 px-1 text-[12px] font-bold text-slate-700">Add a step</p>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NODE_CATEGORIES.flatMap((cat) =>
            cat.types.map((type) => {
              const meta = nodeMeta[type];
              const Icon = meta.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onAdd(type)}
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50/50 px-3 py-2 transition hover:border-emerald-200 hover:bg-emerald-50/40 active:scale-95"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${meta.gradient} text-white shadow-sm`}>
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </div>
                  <span className="text-[12px] font-semibold text-slate-700">{meta.label}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!hideIntro ? (
        <div className="rounded-xl bg-gradient-to-br from-slate-50 to-emerald-50/30 px-3 py-3 ring-1 ring-slate-100">
          <p className="text-[12px] font-bold text-slate-700">Add a step</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">Tap one below</p>
        </div>
      ) : null}

      {NODE_CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{cat.label}</p>
          <div className="space-y-1">
            {cat.types.map((type) => {
              const meta = nodeMeta[type];
              const Icon = meta.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onAdd(type)}
                  className="group flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition hover:border-slate-200/80 hover:bg-white hover:shadow-sm active:scale-[0.99]"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.gradient} text-white shadow-sm transition group-hover:scale-105`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-slate-800">{meta.label}</p>
                    <p className="truncate text-[10px] text-slate-500">{meta.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
