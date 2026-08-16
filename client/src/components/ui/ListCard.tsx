import type { ReactNode } from 'react';

interface ListCardProps {
  children: ReactNode;
  className?: string;
}

export default function ListCard({ children, className = '' }: ListCardProps) {
  return (
    <div className={`dashboard-card p-[var(--card-pad)] transition hover:shadow-panel ${className}`}>
      {children}
    </div>
  );
}
