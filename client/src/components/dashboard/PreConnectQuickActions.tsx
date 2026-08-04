import { Link } from 'react-router-dom';
import {
  ChevronRight,
  FileText,
  LayoutGrid,
  LineChart,
  Megaphone,
  UserPlus,
  Zap,
} from 'lucide-react';

const ACTIONS = [
  {
    to: '/campaigns',
    label: 'Create New Campaign',
    icon: Megaphone,
    well: 'bg-orange-100 text-orange-600',
  },
  {
    to: '/contacts',
    label: 'Add New Contact',
    icon: UserPlus,
    well: 'bg-emerald-100 text-emerald-600',
  },
  {
    to: '/templates',
    label: 'Create New Template',
    icon: FileText,
    well: 'bg-violet-100 text-violet-600',
  },
  {
    to: '/reports',
    label: 'View Reports',
    icon: LineChart,
    well: 'bg-sky-100 text-sky-600',
  },
] as const;

interface PreConnectQuickActionsProps {
  onExploreFeatures?: () => void;
}

export default function PreConnectQuickActions({ onExploreFeatures }: PreConnectQuickActionsProps) {
  return (
    <aside
      aria-label="Quick actions"
      className="flex h-full min-w-[260px] flex-col rounded-2xl border border-neutral-100/90 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.05)] sm:min-w-[280px] sm:p-5"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
          <Zap className="h-4 w-4" fill="currentColor" strokeWidth={0} />
        </span>
        <h3 className="text-[14px] font-bold tracking-tight text-neutral-900 sm:text-[14.5px]">
          Quick Actions
        </h3>
      </div>

      <ul className="mt-3.5 flex flex-1 flex-col gap-1">
        {ACTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-neutral-50"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.well}`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-semibold text-neutral-800 sm:text-[13.5px]">
                  {item.label}
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-500"
                  strokeWidth={2.25}
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => onExploreFeatures?.()}
        className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/35 bg-[#E8F8EE] px-3 py-2.5 text-[13px] font-bold text-[#159A45] transition hover:border-[#25D366]/55 hover:bg-[#dcf5e6] sm:text-[13.5px]"
      >
        <LayoutGrid className="h-4 w-4" strokeWidth={2.25} />
        Explore All Features
      </button>
    </aside>
  );
}
