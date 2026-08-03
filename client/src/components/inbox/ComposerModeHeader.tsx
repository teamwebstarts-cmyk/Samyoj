import { Blocks, LayoutTemplate, MessageSquare, X } from 'lucide-react';

export type ComposerTab = 'reply' | 'template' | 'interactive';

interface ComposerModeHeaderProps {
  active: ComposerTab;
  replyLocked?: boolean;
  onChange: (tab: ComposerTab) => void;
  /** When template/interactive is active — X returns to Reply. */
  onClose?: () => void;
}

const TABS: {
  id: ComposerTab;
  label: string;
  icon: typeof MessageSquare;
  lockedWhen?: 'replyLocked';
}[] = [
  { id: 'reply', label: 'Reply', icon: MessageSquare, lockedWhen: 'replyLocked' },
  { id: 'template', label: 'Template', icon: LayoutTemplate },
  { id: 'interactive', label: 'Interactive', icon: Blocks, lockedWhen: 'replyLocked' },
];

function tabLocked(tab: (typeof TABS)[number], replyLocked?: boolean): boolean {
  return Boolean(tab.lockedWhen === 'replyLocked' && replyLocked);
}

export default function ComposerModeHeader({
  active,
  replyLocked,
  onChange,
  onClose,
}: ComposerModeHeaderProps) {
  const showClose = Boolean(onClose) && (active === 'template' || active === 'interactive');

  return (
    <div
      className="flex items-center gap-3 border-b border-neutral-100 px-3 pt-1 sm:gap-4 sm:px-4 dark:border-neutral-800/80"
      role="tablist"
      aria-label="Composer mode"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const selected = active === tab.id;
          const locked = tabLocked(tab, replyLocked);
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={locked}
              onClick={() => onChange(tab.id)}
              className={`relative inline-flex items-center gap-1.5 pb-2 pt-1.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                selected
                  ? 'text-whatsapp-600 dark:text-whatsapp-400'
                  : 'text-theme-muted hover:text-theme-fg'
              }`}
            >
              <Icon size={14} strokeWidth={2} className="shrink-0" />
              <span>{tab.label}</span>
              {selected && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-whatsapp-500" />
              )}
            </button>
          );
        })}
      </div>

      {showClose && (
        <button
          type="button"
          onClick={onClose}
          className="-mt-0.5 shrink-0 rounded-lg p-1.5 text-theme-muted transition hover:bg-neutral-100 hover:text-theme-fg dark:hover:bg-neutral-800"
          aria-label="Back to reply"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
