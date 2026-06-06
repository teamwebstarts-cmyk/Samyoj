import type { ReactNode } from 'react';

interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export default function FilterBar({ children, className = '' }: FilterBarProps) {
  return (
    <div
      className={`dashboard-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      {children}
    </div>
  );
}
