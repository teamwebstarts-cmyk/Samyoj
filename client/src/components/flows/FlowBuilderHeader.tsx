import { Link } from 'react-router-dom';
import { Check, ChevronRight, Copy, FileEdit, Save } from 'lucide-react';
import AppButton from '../ui/AppButton';

interface FlowBuilderHeaderProps {
  title: string;
  subtitle: string;
  badge: string;
  isNew: boolean;
  saved: boolean;
  saving: boolean;
  enabled?: boolean;
  onDuplicate?: () => void;
  onSaveDraft: () => void;
  onSave: () => void;
}

function badgeClass(badge: string) {
  const normalized = badge.toLowerCase();
  if (normalized === 'live') {
    return 'rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100/90 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-500/20';
  }
  if (normalized === 'draft') {
    return 'rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-500/10 dark:text-amber-300';
  }
  if (normalized === 'off') {
    return 'rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600 dark:bg-theme-subtle dark:text-theme-muted';
  }
  return 'rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
}

/** In-page builder chrome: breadcrumb, status, and save actions. */
export default function FlowBuilderHeader({
  title,
  subtitle,
  badge,
  isNew,
  saved,
  saving,
  enabled = false,
  onDuplicate,
  onSaveDraft,
  onSave,
}: FlowBuilderHeaderProps) {
  return (
    <header className="shrink-0 border-b border-slate-200/60 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
            <Link
              to="/automations"
              className="truncate text-[13px] font-bold text-neutral-500 transition hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Automations
            </Link>
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-neutral-300 dark:text-slate-600"
              aria-hidden
            />
            <h1 className="truncate text-[15px] font-extrabold tracking-tight text-neutral-900 sm:text-[17px] dark:text-white">
              {title}
            </h1>
            {badge ? <span className={badgeClass(badge)}>{badge}</span> : null}
          </div>
          {subtitle ? (
            <p className="mt-1 truncate text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
          {!isNew && onDuplicate ? (
            <button
              type="button"
              onClick={onDuplicate}
              className="hidden h-9 items-center gap-1.5 rounded-lg border border-theme-border px-3 text-[12px] font-semibold text-theme-secondary transition hover:bg-theme-subtle md:inline-flex"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </button>
          ) : null}
          <AppButton
            size="sm"
            variant="secondary"
            className="shrink-0"
            icon={<FileEdit size={15} />}
            loading={saving}
            onClick={onSaveDraft}
          >
            Save draft
          </AppButton>
          <AppButton
            size="sm"
            className="shrink-0"
            icon={saved ? <Check size={15} /> : <Save size={15} />}
            loading={saving}
            onClick={onSave}
          >
            {saved ? 'Saved' : enabled ? 'Publish' : 'Save'}
          </AppButton>
        </div>
      </div>
    </header>
  );
}
