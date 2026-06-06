import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';

type AppAlertVariant = 'success' | 'error' | 'info';

interface AppAlertProps {
  variant?: AppAlertVariant;
  children: ReactNode;
  className?: string;
}

const styles: Record<AppAlertVariant, { wrap: string; icon: typeof CheckCircle2 }> = {
  success: {
    wrap: 'border-emerald-200/80 bg-emerald-50/90 text-emerald-800',
    icon: CheckCircle2,
  },
  error: {
    wrap: 'border-red-200/80 bg-red-50/90 text-red-700',
    icon: AlertCircle,
  },
  info: {
    wrap: 'border-sky-200/80 bg-sky-50/90 text-sky-800',
    icon: Info,
  },
};

export default function AppAlert({ variant = 'info', children, className = '' }: AppAlertProps) {
  const { wrap, icon: Icon } = styles[variant];

  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] font-medium ${wrap} ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
