import { Copy, Eye, FileText } from 'lucide-react';
import AppButton from '../ui/AppButton';
import StatusBadge from '../ui/StatusBadge';
import type { MessageTemplate } from '../../types';
import { getTemplatePreviewSnippet } from '../../utils/templateUtils';
import { getCategoryMeta } from './templateUi';

interface TemplateCardProps {
  template: MessageTemplate;
  onView: () => void;
  onDuplicate?: () => void;
}

export default function TemplateCard({ template, onView, onDuplicate }: TemplateCardProps) {
  const preview = getTemplatePreviewSnippet(template);
  const category = getCategoryMeta(template.category);
  const CategoryIcon = category?.icon ?? FileText;

  return (
    <article className="bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50">
      <button type="button" onClick={onView} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${category?.iconBg ?? 'bg-gradient-to-br from-rose-500 to-pink-600'}`}
        >
          <CategoryIcon className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-mono text-[13px] font-bold text-theme-fg">{template.name}</h3>
            <StatusBadge status={template.status} />
          </div>
          <p className="mt-1 text-[11px] text-theme-muted">
            {template.language} · {category?.label ?? template.category}
          </p>
          {preview && (
            <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-theme-secondary">{preview}</p>
          )}
        </div>
      </button>
      <div className="flex items-center gap-2 border-t border-theme-border/60 bg-theme-subtle/20 px-3 py-2.5">
        <AppButton size="sm" className="flex-1" variant="secondary" icon={<Eye size={14} />} onClick={onView}>
          View
        </AppButton>
        {onDuplicate && (
          <AppButton size="sm" variant="secondary" icon={<Copy size={14} />} onClick={onDuplicate} aria-label="Duplicate" />
        )}
      </div>
    </article>
  );
}
