import type { ReactNode } from 'react';

interface ListCardProps {
  children: ReactNode;
  className?: string;
}

export default function ListCard({ children, className = '' }: ListCardProps) {
  return (
    <div className={`dashboard-card p-4 transition hover:shadow-panel sm:p-5 ${className}`}>
      {children}
    </div>
  );
}
