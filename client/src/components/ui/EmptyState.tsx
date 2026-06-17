import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  illustration?: ReactNode;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  illustration,
}: EmptyStateProps) {
  return (
    <div
      className="dashboard-card flex flex-col items-center px-6 py-12 text-center sm:py-14"
      role="status"
    >
      {illustration ?? (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 text-whatsapp-600 shadow-[0_4px_14px_rgba(37,211,102,0.12)] dark:from-whatsapp-500/15 dark:to-emerald-900/30 dark:text-whatsapp-400">
          <Icon className="h-6 w-6" strokeWidth={2} />
        </div>
      )}
      <h3 className="mt-4 text-base font-extrabold text-theme-fg">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-label font-medium text-theme-secondary">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
