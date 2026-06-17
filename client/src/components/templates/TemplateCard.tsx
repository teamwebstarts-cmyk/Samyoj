import { Eye, FileText } from 'lucide-react';
import AppButton from '../ui/AppButton';
import StatusBadge from '../ui/StatusBadge';
import type { MessageTemplate } from '../../types';
import { getTemplatePreviewSnippet } from '../../utils/templateUtils';

interface TemplateCardProps {
  template: MessageTemplate;
  onView: () => void;
}

export default function TemplateCard({ template, onView }: TemplateCardProps) {
  const preview = getTemplatePreviewSnippet(template);

  return (
    <article className="dashboard-card overflow-hidden p-0 transition active:scale-[0.99]">
      <button type="button" onClick={onView} className="flex w-full items-start gap-3 p-4 text-left">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-label font-extrabold text-theme-fg">{template.name}</h3>
            <StatusBadge status={template.status} />
          </div>
          <p className="mt-1 text-caption text-theme-muted">
            {template.language} · {template.category}
          </p>
          {preview && (
            <p className="mt-2 line-clamp-2 text-caption leading-relaxed text-theme-secondary">{preview}</p>
          )}
        </div>
      </button>
      <div className="border-t border-theme-border bg-theme-subtle/40 p-3">
        <AppButton size="sm" fullWidth variant="secondary" icon={<Eye size={14} />} onClick={onView}>
          View template
        </AppButton>
      </div>
    </article>
  );
}
