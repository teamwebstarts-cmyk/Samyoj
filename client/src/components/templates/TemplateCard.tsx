import { Copy, Eye, FileImage, FileText, Film, FileType } from 'lucide-react';
import AppButton from '../ui/AppButton';
import type { MessageTemplate } from '../../types';
import { getTemplatePreviewSnippet, getTemplateRejectedReason } from '../../utils/templateUtils';
import { getCategoryMeta } from './templateUi';
import TemplateStatusCell from './TemplateStatusCell';

interface TemplateCardProps {
  template: MessageTemplate;
  onView: () => void;
  onDuplicate?: () => void;
  canManage?: boolean;
}

const ribbonSurface: Record<string, { ribbon: string; fold: string }> = {
  MARKETING: {
    ribbon: 'bg-rose-600 text-white shadow-[0_2px_8px_rgba(225,29,72,0.35)]',
    fold: 'bg-rose-800',
  },
  UTILITY: {
    ribbon: 'bg-sky-600 text-white shadow-[0_2px_8px_rgba(2,132,199,0.35)]',
    fold: 'bg-sky-800',
  },
  AUTHENTICATION: {
    ribbon: 'bg-violet-700 text-white shadow-[0_2px_8px_rgba(109,40,217,0.35)]',
    fold: 'bg-violet-900',
  },
};

function templateHeaderFormat(template: MessageTemplate): string | undefined {
  const header = template.components?.find((c) => c.type === 'HEADER');
  return header?.format?.toUpperCase();
}

function TemplateHeroVisual({ template }: { template: MessageTemplate }) {
  const category = getCategoryMeta(template.category);
  const CategoryIcon = category?.icon ?? FileText;
  const format = templateHeaderFormat(template);

  const mediaIconClass = 'h-9 w-9 shrink-0 sm:h-10 sm:w-10 md:h-11 md:w-11';

  if (format === 'IMAGE') {
    return <FileImage className={`${mediaIconClass} text-sky-600 dark:text-sky-400`} strokeWidth={1.75} />;
  }
  if (format === 'VIDEO') {
    return <Film className={`${mediaIconClass} text-violet-600 dark:text-violet-400`} strokeWidth={1.75} />;
  }
  if (format === 'DOCUMENT') {
    return <FileType className={`${mediaIconClass} text-amber-700 dark:text-amber-400`} strokeWidth={1.75} />;
  }

  return (
    <div
      className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-md sm:h-12 sm:w-12 md:h-12 md:w-12 lg:h-12 lg:w-12 xl:h-14 xl:w-14 ${category?.iconBg ?? 'bg-gradient-to-br from-rose-500 to-pink-600'}`}
    >
      <CategoryIcon className="h-6 w-6 sm:h-7 sm:w-7 md:h-7 md:w-7 lg:h-7 lg:w-7 xl:h-8 xl:w-8" strokeWidth={2} />
    </div>
  );
}

function CategoryRibbon({ category }: { category?: string }) {
  const meta = getCategoryMeta(category);
  if (!meta) return null;
  const upper = (category || '').toUpperCase();
  const tone = ribbonSurface[upper] ?? {
    ribbon: 'bg-neutral-700 text-white shadow-md',
    fold: 'bg-neutral-900',
  };

  return (
    <div className="pointer-events-none absolute left-0 top-3 z-10 -translate-x-1.5 sm:top-3.5">
      <span
        className={`relative block rounded-r-lg px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] sm:px-4 sm:text-xs md:px-4 md:py-2 md:text-[13px] ${tone.ribbon}`}
      >
        {meta.label}
      </span>
      <span
        className={`absolute -bottom-2 left-0 block h-2.5 w-2.5 sm:h-3 sm:w-3 sm:-bottom-2.5 ${tone.fold}`}
        style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
        aria-hidden
      />
    </div>
  );
}

export default function TemplateCard({ template, onView, onDuplicate, canManage = true }: TemplateCardProps) {
  const preview = getTemplatePreviewSnippet(template, 180);
  const rejectedReason = getTemplateRejectedReason(template.rejected_reason);

  return (
    <article
      className="relative flex h-full min-h-[16rem] w-full flex-col overflow-visible rounded-2xl border border-neutral-200/90 bg-white shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50/80 sm:min-h-[16.5rem] md:min-h-[17rem] lg:min-h-[17.25rem] xl:min-h-[17.5rem] dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700 dark:hover:bg-neutral-900/50"
    >
      <CategoryRibbon category={template.category} />

      <div className="flex flex-1 flex-col gap-2 px-3 pb-2 pt-10 sm:gap-2.5 sm:px-3.5 sm:pt-11 md:gap-3 md:pt-12">
        <div className="flex shrink-0 justify-center">
          <TemplateHeroVisual template={template} />
        </div>

        <h3 className="shrink-0 text-center font-mono text-[13px] font-bold leading-snug text-neutral-900 sm:text-sm md:text-[13.5px] lg:text-sm xl:text-[14px] dark:text-neutral-100">
          <span className="line-clamp-2 break-all md:line-clamp-1">{template.name}</span>
        </h3>

        <div className="flex shrink-0 justify-center">
          <TemplateStatusCell
            variant="badge"
            badgeClassName="px-2.5 py-1 text-[11px] sm:text-xs md:px-2.5 md:py-0.5 md:text-[11px] lg:text-xs"
            status={template.status}
            qualityScore={template.quality_score?.score}
          />
        </div>

        <div className="mt-1.5 flex-1 text-center sm:mt-2 md:mt-2.5">
          {preview ? (
            <p
              className="mx-auto line-clamp-3 max-w-full text-xs leading-relaxed text-neutral-600 sm:text-[13px] sm:leading-relaxed md:line-clamp-4 md:text-[12.5px] md:leading-snug lg:text-[13px] xl:text-[13px] dark:text-neutral-400"
            >
              {preview}
            </p>
          ) : (
            <p className="text-xs text-neutral-400 sm:text-[13px] md:text-[12.5px] lg:text-[13px]">No preview text</p>
          )}
          {rejectedReason && (
            <p
              className="mx-auto mt-1.5 line-clamp-1 max-w-full text-[11px] font-medium leading-snug text-red-600 sm:text-xs md:line-clamp-2 md:text-[11.5px] lg:text-xs dark:text-red-400"
              title={rejectedReason}
            >
              {rejectedReason}
            </p>
          )}
        </div>
      </div>

      <footer className="flex shrink-0 items-center gap-1 border-t border-neutral-200/80 bg-neutral-50/50 px-1.5 py-1.5 sm:gap-2 sm:px-2.5 sm:py-2 dark:border-neutral-800 dark:bg-neutral-900/30">
        <AppButton
          size="sm"
          className="!min-h-9 min-w-0 flex-1 !h-9 !px-2 text-xs sm:!min-h-10 sm:!h-10 sm:text-[13px] md:!min-h-10 md:!h-10 md:text-[13px] lg:text-xs"
          variant="secondary"
          icon={<Eye size={14} />}
          onClick={onView}
        >
          Preview
        </AppButton>
        {onDuplicate && (
          <AppButton
            size="sm"
            className="!size-9 shrink-0 !min-h-9 !min-w-9 !p-0 sm:!size-10 sm:!min-h-10 sm:!min-w-10 md:!size-10 md:!min-h-10 md:!min-w-10"
            variant="secondary"
            icon={<Copy size={14} />}
            onClick={onDuplicate}
            disabled={!canManage}
            aria-label="Duplicate template"
          />
        )}
      </footer>
    </article>
  );
}
