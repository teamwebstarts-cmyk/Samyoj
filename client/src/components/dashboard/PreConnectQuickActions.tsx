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
      className="flex w-full min-w-[260px] flex-col rounded-2xl border border-neutral-200/80 bg-white p-[var(--card-pad)] shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:min-w-[280px]"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center text-sky-500">
          <Zap className="h-4 w-4" fill="currentColor" strokeWidth={0} />
        </span>
        <h3 className="text-[14px] font-bold tracking-tight text-neutral-900 sm:text-[14.5px]">
          Quick Actions
        </h3>
      </div>

      <ul className="flex flex-col gap-2">
        {ACTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className="group flex items-center gap-2.5 rounded-xl border border-neutral-200/90 bg-white px-2.5 py-2.5 transition hover:border-neutral-300 hover:bg-neutral-50/80"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.well}`}
                >
                  <Icon className="h-[17px] w-[17px]" strokeWidth={2.1} />
                </span>
                <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-neutral-800 sm:text-[13px]">
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
        className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E7F8EF] px-3 py-2.5 text-[12.5px] font-bold text-[#0D9F6E] transition hover:bg-[#d8f3e5] sm:text-[13px]"
      >
        <LayoutGrid className="h-4 w-4" strokeWidth={2.25} />
        Explore All Features
      </button>
    </aside>
  );
}
