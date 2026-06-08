import { CheckSquare, ChevronDown, Send, Tag, Trash2, UserCheck, UserX, X } from 'lucide-react';
import { useState } from 'react';
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';

interface ContactBulkBarProps {
  selectedCount: number;
  bulkTags: string;
  onBulkTagsChange: (value: string) => void;
  onClear: () => void;
  onAddTags: () => void;
  onRemoveTags: () => void;
  onOptIn: () => void;
  onOptOut: () => void;
  onDelete: () => void;
  onAddToCampaign: () => void;
  busy?: boolean;
}

export default function ContactBulkBar({
  selectedCount,
  bulkTags,
  onBulkTagsChange,
  onClear,
  onAddTags,
  onRemoveTags,
  onOptIn,
  onOptOut,
  onDelete,
  onAddToCampaign,
  busy,
}: ContactBulkBarProps) {
  const [expanded, setExpanded] = useState(false);
  const { collapsed } = useSidebarCollapsed();

  if (!selectedCount) return null;

  return (
    <div
      className={`pointer-events-none fixed bottom-0 right-0 z-40 flex justify-center page-gutter-x pb-4 sm:pb-6 ${
        collapsed ? 'lg:left-[72px]' : 'lg:left-[260px]'
      } left-0`}
    >
      <div className="pointer-events-auto mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-sky-200/80 bg-theme-surface/95 shadow-[0_8px_32px_rgba(14,165,233,0.18),0_2px_8px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-sky-800/50 dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500" />

        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.35)]">
              <CheckSquare className="h-4 w-4" strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-[14px] font-extrabold tracking-tight text-theme-fg">
                {selectedCount} selected
              </p>
              <p className="text-[11px] font-medium text-theme-muted">
                Bulk actions apply to checked contacts
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AppButton
              size="sm"
              icon={<Send size={14} />}
              onClick={onAddToCampaign}
              disabled={busy}
            >
              Campaign
            </AppButton>
            <AppButton
              size="sm"
              variant="secondary"
              icon={<UserCheck size={14} />}
              onClick={onOptIn}
              disabled={busy}
            >
              Opt in
            </AppButton>
            <AppButton
              size="sm"
              variant="secondary"
              icon={<UserX size={14} />}
              onClick={onOptOut}
              disabled={busy}
            >
              Opt out
            </AppButton>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-theme-border bg-theme-subtle px-3 text-[12px] font-bold text-theme-secondary transition hover:bg-theme-surface"
            >
              <Tag className="h-3.5 w-3.5" />
              Tags
              <ChevronDown
                className={`h-3.5 w-3.5 transition ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
            <AppButton
              size="sm"
              variant="danger"
              icon={<Trash2 size={14} />}
              onClick={onDelete}
              disabled={busy}
            >
              Delete
            </AppButton>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-theme-muted transition hover:bg-theme-subtle hover:text-theme-fg"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {expanded && (
          <div className="flex flex-col gap-2 border-t border-theme-border bg-theme-subtle/40 px-4 py-3 sm:flex-row sm:items-center">
            <AppInput
              className="flex-1"
              placeholder="Enter tags separated by commas"
              value={bulkTags}
              onChange={(e) => onBulkTagsChange(e.target.value)}
            />
            <div className="flex gap-2">
              <AppButton size="sm" variant="secondary" onClick={onAddTags} disabled={busy}>
                Add tags
              </AppButton>
              <AppButton size="sm" variant="ghost" onClick={onRemoveTags} disabled={busy}>
                Remove tags
              </AppButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
