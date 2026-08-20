import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

type GuidanceTone = 'rose' | 'sky';

const toneStyles: Record<
  GuidanceTone,
  { shell: string; icon: string; title: string; body: string; divider: string }
> = {
  rose: {
    shell: 'border-rose-200/80 bg-rose-50/70 dark:border-rose-900/40 dark:bg-rose-950/25',
    icon: 'text-rose-600 dark:text-rose-400',
    title: 'text-rose-900 dark:text-rose-200',
    body: 'text-rose-800/90 dark:text-rose-300/90',
    divider: 'border-rose-200/60 dark:border-rose-900/50',
  },
  sky: {
    shell: 'border-sky-200/70 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/30',
    icon: 'text-sky-600 dark:text-sky-400',
    title: 'text-sky-900 dark:text-sky-200',
    body: 'text-sky-900 dark:text-sky-200',
    divider: 'border-sky-200/60 dark:border-sky-900/50',
  },
};

interface TemplateGuidanceDisclosureProps {
  title: string;
  icon: LucideIcon;
  tone: GuidanceTone;
  children: ReactNode;
  defaultOpen?: boolean;
}

export default function TemplateGuidanceDisclosure({
  title,
  icon: Icon,
  tone,
  children,
  defaultOpen = false,
}: TemplateGuidanceDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const styles = toneStyles[tone];

  return (
    <div className={`rounded-xl border ${styles.shell}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <Icon className={`h-4 w-4 shrink-0 ${styles.icon}`} strokeWidth={2.25} aria-hidden />
        <span className={`min-w-0 flex-1 text-[13px] font-bold ${styles.title}`}>{title}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform dark:text-slate-400 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id={panelId}
          className={`border-t px-4 pb-3 pt-2 text-[12px] leading-relaxed ${styles.divider} ${styles.body}`}
        >
          <div className="pl-7">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
