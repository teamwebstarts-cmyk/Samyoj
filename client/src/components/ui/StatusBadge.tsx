import { getStatusStyle } from './statusTokens';

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export default function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-micro uppercase tracking-wide ring-1 ring-inset ${getStatusStyle(status)} ${className}`}
    >
      {label ?? status}
    </span>
  );
}
