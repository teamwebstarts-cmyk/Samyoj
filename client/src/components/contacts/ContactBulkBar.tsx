import { CheckSquare, Send, Tag, Trash2, UserCheck, UserX, X } from 'lucide-react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed';
import AppButton from '../ui/AppButton';
import { messagingConsent } from '../../utils/plainLanguage';

interface ContactBulkBarProps {
  selectedCount: number;
  onClear: () => void;
  onOpenTags: () => void;
  onOptIn: () => void;
  onOptOut: () => void;
  onDelete: () => void;
  onAddToCampaign: () => void;
  busy?: boolean;
}

export default function ContactBulkBar({
  selectedCount,
  onClear,
  onOpenTags,
  onOptIn,
  onOptOut,
  onDelete,
  onAddToCampaign,
  busy,
}: ContactBulkBarProps) {
  const { collapsed } = useSidebarCollapsed();
  const breakpoint = useBreakpoint();
  const forceCollapsed = breakpoint === 'md' || collapsed;

  if (!selectedCount) return null;

  return (
    <div
      className={`pointer-events-none fixed bottom-0 right-0 z-40 flex justify-center page-gutter-x pb-[calc(1rem+env(safe-area-inset-bottom,0px)+4rem)] sm:pb-6 md:pb-6 ${
        forceCollapsed ? 'md:left-[80px]' : 'md:left-[80px] lg:left-[280px]'
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
              icon={<Tag size={14} />}
              onClick={onOpenTags}
              disabled={busy}
            >
              Tags
            </AppButton>
            <AppButton
              size="sm"
              variant="secondary"
              icon={<UserCheck size={14} />}
              onClick={onOptIn}
              disabled={busy}
            >
              {messagingConsent.allowMessages}
            </AppButton>
            <AppButton
              size="sm"
              variant="secondary"
              icon={<UserX size={14} />}
              onClick={onOptOut}
              disabled={busy}
            >
              {messagingConsent.stopMessages}
            </AppButton>
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
      </div>
    </div>
  );
}
