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
    <article className="bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-[0_4px_14px_rgba(99,102,241,0.28)]">
          <GitBranch className="h-4 w-4" strokeWidth={2.25} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-label font-extrabold text-theme-fg">{flow.name}</h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${
                flow.enabled
                  ? 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/20 dark:text-emerald-300'
                  : 'bg-theme-subtle text-theme-muted ring-theme-border'
              }`}
            >
              {flow.enabled ? 'On' : 'Off'}
            </span>
          </div>

          {flow.description && (
            <p className="mt-1 line-clamp-2 text-caption leading-relaxed text-theme-secondary">
              {flow.description}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                trigger?.accent || 'bg-theme-subtle text-theme-secondary ring-theme-border'
              }`}
            >
              {trigger?.label || flow.triggerType}
            </span>
            {flow.triggerType === 'KEYWORD' && keyword && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-300">
                <Hash className="h-3 w-3" />
                {keyword}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-caption font-semibold text-theme-muted">
              <Layers className="h-3.5 w-3.5 text-violet-500" />
              {stepCount} {stepCount === 1 ? 'step' : 'steps'}
            </span>
          </div>
        </div>
      </button>

      <div className="flex flex-wrap items-center gap-2 border-t border-theme-border/60 bg-theme-subtle/20 px-3 py-2.5">
        <AppButton
          size="sm"
          className="flex-1 sm:flex-none"
          variant={flow.enabled ? 'secondary' : 'primary'}
          icon={flow.enabled ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
          onClick={onToggle}
        >
          {flow.enabled ? 'Turn off' : 'Turn on'}
        </AppButton>
        <AppButton size="sm" variant="secondary" icon={<Copy size={14} />} onClick={onDuplicate}>
          Copy
        </AppButton>
        <AppButton size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={onOpen}>
          Edit
        </AppButton>
        <AppButton size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={onDelete} aria-label="Delete" />
      </div>
    </article>
  );
}
