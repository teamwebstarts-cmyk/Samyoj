import { getStatusStyle } from './statusTokens';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-micro uppercase tracking-wide ring-1 ring-inset ${getStatusStyle(status)} ${className}`}
    >
      {status}
    </span>
  );
}
