import type { HealthFlags } from '../../types';

export function FlagPills({ flags }: { flags: HealthFlags }) {
  const items = [
    flags.aiInactive && 'AI inactive',
    flags.billingRisk && 'Billing risk',
    flags.qualityRisk && 'Quality risk',
    flags.webhookStale && 'Webhook stale',
  ].filter(Boolean) as string[];
  if (!items.length) return <span className="text-xs text-ink/45">No flags</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-signal/10 px-2 py-0.5 text-[11px] font-semibold text-signal"
        >
          {item}
        </span>
      ))}
    </div>
  );
}
