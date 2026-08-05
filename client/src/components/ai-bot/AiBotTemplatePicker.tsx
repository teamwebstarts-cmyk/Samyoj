import { ArrowRight, LayoutTemplate } from 'lucide-react';
import type { BotTemplate } from './botTemplates';

interface AiBotTemplatePickerProps {
  templates: BotTemplate[];
  onSelect: (template: BotTemplate) => void;
  compact?: boolean;
}

function TemplateCard({
  template,
  onSelect,
  compact,
}: {
  template: BotTemplate;
  onSelect: () => void;
  compact?: boolean;
}) {
  const Icon = template.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex items-start gap-3 rounded-2xl border bg-gradient-to-br text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.995] ${template.accent} ${
        compact ? 'p-3.5' : 'p-4'
      }`}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105 ${template.iconBg} ${
          compact ? 'h-9 w-9' : 'h-10 w-10'
        }`}
      >
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-extrabold text-theme-fg ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
          {template.name}
        </p>
        <p
          className={`mt-1 font-medium leading-relaxed text-theme-secondary ${
            compact ? 'line-clamp-1 text-[11px]' : 'text-[11px]'
          }`}
        >
          {template.description}
        </p>
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-violet-700 opacity-0 transition group-hover:opacity-100 dark:text-violet-400">
          Use template
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
}

export default function AiBotTemplatePicker({ templates, onSelect, compact }: AiBotTemplatePickerProps) {
  return (
    <section className="dashboard-card overflow-hidden p-0">
      <div className="flex items-start justify-between gap-3 border-b border-theme-border bg-theme-subtle/50 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            <LayoutTemplate className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[14px] font-extrabold tracking-tight text-theme-fg">
              {compact ? 'Start from' : 'Start from'}
            </h3>
            <p className="text-[12px] font-medium text-theme-secondary">
              Support desk · Sales desk · FAQ helper — lands on Personality
            </p>
          </div>
        </div>
      </div>
      <div className={`grid gap-3 p-4 sm:p-5 ${compact ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={() => onSelect(template)}
            compact={compact}
          />
        ))}
      </div>
    </section>
  );
}
