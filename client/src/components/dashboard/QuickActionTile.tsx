import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';

interface QuickActionTileProps {
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  gradient: string;
  iconBg: string;
}

export default function QuickActionTile({
  to,
  label,
  desc,
  icon: Icon,
  gradient,
  iconBg,
}: QuickActionTileProps) {
  return (
    <Link
      to={to}
      className={`group relative overflow-hidden rounded-2xl border border-white/60 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-panel ${gradient}`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/30 blur-2xl transition group-hover:bg-white/40" />
      <div className="relative flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-neutral-700" />
      </div>
      <div className="relative mt-3">
        <p className="text-[13px] font-bold text-neutral-900">{label}</p>
        <p className="mt-0.5 text-[11px] font-medium text-neutral-600">{desc}</p>
      </div>
    </Link>
  );
}
