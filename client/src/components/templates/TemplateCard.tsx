import { Copy, Eye, FileText } from 'lucide-react';
import AppButton from '../ui/AppButton';
import type { MessageTemplate } from '../../types';
import { getTemplatePreviewSnippet, getTemplateRejectedReason } from '../../utils/templateUtils';
import { CategoryInlinePill, getCategoryMeta } from './templateUi';
import TemplateStatusCell from './TemplateStatusCell';

interface TemplateCardProps {
  template: MessageTemplate;
  onView: () => void;
  onDuplicate?: () => void;
}

export default function TemplateCard({ template, onView, onDuplicate }: TemplateCardProps) {
  const preview = getTemplatePreviewSnippet(template);
  const category = getCategoryMeta(template.category);
  const CategoryIcon = category?.icon ?? FileText;
  const rejectedReason = getTemplateRejectedReason(template.rejected_reason);

  return (
    <article className="min-w-0 overflow-hidden bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50">
      <button type="button" onClick={onView} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${category?.iconBg ?? 'bg-gradient-to-br from-rose-500 to-pink-600'}`}
        >
          <CategoryIcon className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-mono text-[13px] font-bold text-neutral-900 dark:text-neutral-100">
              {template.name}
            </h3>
            <CategoryInlinePill category={template.category} />
          </div>
          {preview && (
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-neutral-500">{preview}</p>
          )}
          <div className="mt-2">
            <TemplateStatusCell
              status={template.status}
              qualityScore={template.quality_score?.score}
              rejectedReason={rejectedReason}
            />
          </div>
        </div>
      </button>
      <div className="flex items-center gap-2 border-t border-neutral-200/80 bg-neutral-50/50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/30">
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
