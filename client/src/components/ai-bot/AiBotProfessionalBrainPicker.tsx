import { ArrowRight, Sparkles } from 'lucide-react';
import type { ProfessionalBrain } from './professionalBrains';

interface AiBotProfessionalBrainPickerProps {
  brains: ProfessionalBrain[];
  onSelect: (brain: ProfessionalBrain) => void;
  compact?: boolean;
}

function BrainCard({
  brain,
  onSelect,
  compact,
}: {
  brain: ProfessionalBrain;
  onSelect: () => void;
  compact?: boolean;
}) {
  const Icon = brain.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex items-start gap-3 rounded-2xl border bg-gradient-to-br text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.995] ${brain.accent} ${
        compact ? 'p-3.5' : 'p-4'
      }`}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105 ${brain.iconBg} ${
          compact ? 'h-9 w-9' : 'h-10 w-10'
        }`}
      >
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`font-extrabold text-theme-fg ${compact ? 'text-[13px]' : 'text-[14px]'}`}>
            {brain.name}
          </p>
          {brain.recommended && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800">
              Recommended
            </span>
          )}
        </div>
        <p
          className={`mt-0.5 font-medium text-theme-muted ${
            compact ? 'text-[10px]' : 'text-[11px]'
          }`}
        >
          {brain.tagline}
        </p>
        <p className={`mt-1 text-[11px] font-medium text-theme-secondary ${compact ? 'hidden sm:line-clamp-1' : 'line-clamp-2'}`}>
          {brain.description}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {brain.personalityTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-3 text-[10px] font-medium text-theme-muted">
          <span className="flex items-center gap-1">
            <span className="text-theme-fg">{brain.knowledgeItems.length}</span> pre-loaded FAQs
          </span>
          <span>Chat + Voice</span>
        </div>
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-violet-700 opacity-0 transition group-hover:opacity-100 dark:text-violet-400">
          Use this brain
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
}

export default function AiBotProfessionalBrainPicker({
  brains,
  onSelect,
  compact,
}: AiBotProfessionalBrainPickerProps) {
  return (
    <section className="dashboard-card overflow-hidden p-0 shadow-xs">
      <div className="flex items-start justify-between gap-3 border-b border-theme-border bg-theme-subtle/50 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[14px] font-extrabold tracking-tight text-theme-fg">
              Professional brains
            </h3>
            <p className="text-[12px] font-medium text-theme-secondary">
              Pre-loaded instructions + FAQs for chat and voice calls
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:p-5 sm:grid-cols-2">
        {brains.map((brain) => (
          <BrainCard
            key={brain.id}
            brain={brain}
            onSelect={() => onSelect(brain)}
            compact={compact}
          />
        ))}
      </div>
    </section>
  );
}
