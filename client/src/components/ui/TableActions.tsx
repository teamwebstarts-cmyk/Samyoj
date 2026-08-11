import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useGlassTipProps, useInboxGlassTipActive } from '../inbox/ComposerGlassTip';

const iconVariants = {
  default:
    'border-theme-border bg-theme-surface text-theme-secondary hover:border-whatsapp-500/30 hover:bg-whatsapp-500/10 hover:text-whatsapp-600 dark:hover:text-whatsapp-400',
  primary:
    'border-emerald-200/80 bg-emerald-50 text-whatsapp-700 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-900/30 dark:text-emerald-300',
  danger:
    'border-red-100 bg-theme-surface text-red-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400',
} as const;

interface TableIconButtonProps {
  onClick?: () => void;
  icon: LucideIcon;
  label: string;
  variant?: keyof typeof iconVariants;
}

export function TableIconButton({
  onClick,
  icon: Icon,
  label,
  variant = 'default',
}: TableIconButtonProps) {
  const getTipProps = useGlassTipProps();
  const glassTipsActive = useInboxGlassTipActive();

  return (
    <button
      type="button"
      onClick={onClick}
      {...getTipProps(label, 'above')}
      title={glassTipsActive ? undefined : label}
      aria-label={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-sm transition ${iconVariants[variant]}`}
    >
      <Icon size={15} strokeWidth={2.25} />
    </button>
  );
}

const textVariants = {
  primary:
    'border-emerald-200/80 bg-emerald-50 text-whatsapp-700 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-900/30 dark:text-emerald-300',
  neutral:
    'border-theme-border bg-theme-surface text-theme-secondary hover:border-theme-border-strong hover:bg-theme-subtle',
} as const;

interface TableTextButtonProps {
  onClick?: () => void;
  icon?: LucideIcon;
  children: ReactNode;
  variant?: keyof typeof textVariants;
}

export function TableTextButton({
  onClick,
  icon: Icon,
  children,
  variant = 'primary',
}: TableTextButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-bold shadow-sm transition ${textVariants[variant]}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />}
      {children}
    </button>
  );
}
