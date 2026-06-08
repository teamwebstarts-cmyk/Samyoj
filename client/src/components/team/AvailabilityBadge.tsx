import type { OrgRole } from '../../types';
import { roleBadgeStyles, roleLabels } from './teamUi';

interface AvailabilityBadgeProps {
  status: import('../../types').AgentAvailability;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const availabilityConfig: Record<
  import('../../types').AgentAvailability,
  { label: string; dot: string; ring: string }
> = {
  ONLINE: { label: 'Online', dot: 'bg-emerald-500', ring: 'ring-emerald-500/30' },
  AWAY: { label: 'Away', dot: 'bg-amber-400', ring: 'ring-amber-400/30' },
  OFFLINE: { label: 'Offline', dot: 'bg-neutral-400', ring: 'ring-neutral-400/20' },
};

export default function AvailabilityBadge({
  status,
  showLabel = true,
  size = 'sm',
}: AvailabilityBadgeProps) {
  const config = availabilityConfig[status];
  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`${dotSize} rounded-full ring-2 ${config.dot} ${config.ring}`}
        aria-hidden
      />
      {showLabel && (
        <span className="text-[11px] font-semibold text-theme-secondary">{config.label}</span>
      )}
    </span>
  );
}

export function RoleBadge({ role }: { role: OrgRole }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${roleBadgeStyles[role]}`}
    >
      {roleLabels[role]}
    </span>
  );
}
