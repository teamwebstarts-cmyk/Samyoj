import type { ReactNode } from 'react';

interface PageHeaderProps {
  actions?: ReactNode;
  className?: string;
}

export default function PageHeader({ actions, className = '' }: PageHeaderProps) {
  if (!actions) return null;

  return (
    <div
      className={`mb-5 flex animate-fade-up flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-end ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{actions}</div>
    </div>
  );
}
