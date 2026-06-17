import { Copy, GitBranch, Hash, Layers, PauseCircle, PlayCircle, Pencil, Trash2 } from 'lucide-react';
import AppButton from '../ui/AppButton';
import { triggerMeta } from './flowMeta';
import type { Flow } from '../../types';

interface FlowCardProps {
  flow: Flow;
  onOpen: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export default function FlowCard({ flow, onOpen, onToggle, onDuplicate, onDelete }: FlowCardProps) {
  const trigger = triggerMeta[flow.triggerType];
  const keyword = flow.triggerConfig?.keyword as string | undefined;
  const stepCount = flow.nodes?.length || 0;

  return (
    <article className="dashboard-card overflow-hidden p-0 transition hover:shadow-panel">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 p-4 text-left active:bg-neutral-50/50 sm:gap-4 sm:p-5"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.3)] sm:h-12 sm:w-12">
          <GitBranch className="h-5 w-5" strokeWidth={2.25} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[15px] font-extrabold tracking-tight text-neutral-900 sm:text-base">
              {flow.name}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${
                flow.enabled
                  ? 'bg-emerald-100 text-emerald-800 ring-emerald-200/70'
                  : 'bg-neutral-100 text-neutral-500 ring-neutral-200/70'
              }`}
            >
              {flow.enabled ? 'On' : 'Off'}
            </span>
          </div>

          {flow.description && (
            <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed text-neutral-500">
              {flow.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                trigger?.accent || 'bg-neutral-100 text-neutral-600 ring-neutral-200/60'
              }`}
            >
              {trigger?.label || flow.triggerType}
            </span>
            {flow.triggerType === 'KEYWORD' && keyword && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-100">
                <Hash className="h-3 w-3" />
                {keyword}
              </span>
            )}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-violet-400" />
              {stepCount} {stepCount === 1 ? 'step' : 'steps'}
            </span>
          </div>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-2 border-t border-neutral-100/80 bg-neutral-50/40 p-3 sm:grid-cols-4 sm:p-4">
        <AppButton
          size="sm"
          fullWidth
          variant={flow.enabled ? 'secondary' : 'primary'}
          icon={flow.enabled ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
          onClick={onToggle}
        >
          {flow.enabled ? 'Turn off' : 'Turn on'}
        </AppButton>
        <AppButton size="sm" fullWidth variant="secondary" icon={<Copy size={14} />} onClick={onDuplicate}>
          Copy
        </AppButton>
        <AppButton size="sm" fullWidth variant="secondary" icon={<Pencil size={14} />} onClick={onOpen}>
          Edit
        </AppButton>
        <AppButton size="sm" fullWidth variant="danger" icon={<Trash2 size={14} />} onClick={onDelete}>
          Delete
        </AppButton>
      </div>
    </article>
  );
}
