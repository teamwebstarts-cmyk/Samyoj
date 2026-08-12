import { ArrowRight, BookOpen, MessageSquare, Phone, Sparkles } from 'lucide-react';
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
      className={`group flex h-full flex-col rounded-2xl border bg-gradient-to-br text-left transition duration-200 hover:border-emerald-300/70 hover:shadow-[0_1px_2px_rgba(15,23,42,0.05)] active:scale-[0.995] ${brain.accent} ${
        compact ? 'p-3.5' : 'p-4 sm:p-5'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl ${brain.iconBg} ${
            compact ? 'h-10 w-10' : 'h-11 w-11'
          }`}
        >
          <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className={`font-extrabold tracking-tight text-theme-fg ${compact ? 'text-[13px]' : 'text-[15px]'}`}>
              {brain.name.replace(/^The /, '')}
            </p>
            {brain.recommended && (
              <span className="rounded-lg border border-emerald-200/80 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/40 dark:text-emerald-300">
                Popular
              </span>
            )}
          </div>
          <p className={`mt-0.5 font-semibold text-emerald-800/80 dark:text-emerald-300/90 ${compact ? 'text-[11px]' : 'text-[12px]'}`}>
            {brain.tagline}
          </p>
        </div>
      </div>

      <p
        className={`mt-3 font-medium leading-relaxed text-theme-secondary ${
          compact ? 'line-clamp-2 text-[12px]' : 'text-[13px]'
        }`}
      >
        {brain.description}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {brain.personalityTags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="rounded-lg border border-theme-border/80 bg-white/70 px-2 py-0.5 text-[10px] font-bold text-theme-secondary dark:bg-neutral-900/50"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-theme-secondary">
        <span className="inline-flex items-center gap-1 rounded-lg bg-theme-subtle/80 px-2 py-1">
          <MessageSquare className="h-3 w-3 text-emerald-600" />
          WhatsApp chat
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg bg-theme-subtle/80 px-2 py-1">
          <Phone className="h-3 w-3 text-sky-600" />
          Voice calls
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg bg-theme-subtle/80 px-2 py-1">
          <BookOpen className="h-3 w-3 text-violet-600" />
          {brain.knowledgeItems.length} FAQs
        </span>
      </div>

      <span
        className={`mt-auto inline-flex items-center gap-1.5 pt-3 font-bold text-whatsapp-700 dark:text-emerald-400 ${
          compact ? 'text-[12px]' : 'text-[13px]'
        }`}
      >
        Use this template
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

export default function AiBotProfessionalBrainPicker({
  brains,
  onSelect,
  compact,
}: AiBotProfessionalBrainPickerProps) {
  return (
    <section className="dashboard-card dashboard-card-soft overflow-hidden p-0" aria-labelledby="brains-heading">
      <div className="border-b border-theme-border bg-theme-subtle/40 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 id="brains-heading" className="text-[15px] font-extrabold tracking-tight text-theme-fg">
              Ready-made bot templates
            </h3>
            <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-theme-secondary sm:text-[13px]">
              Pick a starting point — we load personality, handoff rules, and FAQs. You can edit
              everything after create.
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:gap-4 sm:p-5">
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
