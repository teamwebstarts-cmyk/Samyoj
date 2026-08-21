import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  LifeBuoy,
  LineChart,
  MoreHorizontal,
  PhoneCall,
  Scan,
} from 'lucide-react';
import IconWell from './icons/IconWell';
import {
  InboxTileSvg,
  CampaignsTileSvg,
  ContactsSvg,
  AutomationsTileSvg,
} from './icons/DashboardIcons';

interface ActionTileProps {
  to: string;
  label: string;
  desc: string;
  icon: ReactNode;
  bgClass: string;
  wellClass: string;
  isDashed?: boolean;
  onClick?: () => void;
}

const PRIMARY_ACTIONS = [
  {
    to: '/inbox',
    label: 'Inbox',
    desc: 'Reply to customers',
    icon: <InboxTileSvg className="h-[18px] w-[18px] text-emerald-600" />,
    bgClass: 'bg-emerald-50/50 border-emerald-100/80 hover:border-emerald-200 hover:bg-emerald-50/80',
    wellClass: 'bg-emerald-100 text-emerald-600',
  },
  {
    to: '/campaigns',
    label: 'Campaigns',
    desc: 'Send messages',
    icon: <CampaignsTileSvg className="h-[18px] w-[18px] text-violet-600" />,
    bgClass: 'bg-violet-50/50 border-violet-100/80 hover:border-violet-200 hover:bg-violet-50/80',
    wellClass: 'bg-violet-100 text-violet-600',
  },
  {
    to: '/contacts',
    label: 'Contacts',
    desc: 'Manage customers',
    icon: <ContactsSvg className="h-[18px] w-[18px] text-sky-600" />,
    bgClass: 'bg-sky-50/50 border-sky-100/80 hover:border-sky-200 hover:bg-sky-50/80',
    wellClass: 'bg-sky-100 text-sky-600',
  },
  {
    to: '/automations',
    label: 'Automations',
    desc: 'Set up auto replies',
    icon: <AutomationsTileSvg className="h-[18px] w-[18px] text-amber-600" />,
    bgClass: 'bg-amber-50/50 border-amber-100/80 hover:border-amber-200 hover:bg-amber-50/80',
    wellClass: 'bg-amber-100 text-amber-600',
  },
  {
    to: '/templates',
    label: 'Templates',
    desc: 'Approved messages',
    icon: <FileText className="h-[18px] w-[18px] text-rose-600 stroke-[2.2]" />,
    bgClass: 'bg-rose-50/50 border-rose-100/80 hover:border-rose-200 hover:bg-rose-50/80',
    wellClass: 'bg-rose-100 text-rose-600',
  },
];

const MORE_MENU_ITEMS = [
  {
    to: '/calls',
    label: 'Calls',
    desc: 'Voice calling',
    icon: PhoneCall,
    accent: 'slate' as const,
  },
  {
    to: '/tickets',
    label: 'Tickets',
    desc: 'Support issues',
    icon: LifeBuoy,
    accent: 'slate' as const,
  },
  {
    to: '/billing?tab=usage',
    label: 'Usage & Stats',
    desc: 'Plan & delivery metrics',
    icon: LineChart,
    accent: 'slate' as const,
  },
];

function ActionTile({
  to,
  label,
  desc,
  icon,
  bgClass,
  wellClass,
  isDashed = false,
  onClick,
}: ActionTileProps) {
  const content = (
    <div
      className={`group flex h-full items-center gap-2 rounded-xl border px-2.5 py-3 transition hover:shadow-xs sm:gap-2.5 sm:px-3 sm:py-3.5 ${
        isDashed
          ? 'border-dashed border-neutral-300 bg-neutral-50/40 hover:border-neutral-400 hover:bg-neutral-50/80'
          : bgClass
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition group-hover:scale-105 sm:h-11 sm:w-11 ${wellClass}`}
      >
        {icon}
      </div>
      <div className="min-w-0 text-left">
        <p className="truncate text-[12px] font-bold tracking-tight text-neutral-900 sm:text-[12.5px]">
          {label}
        </p>
        <p className="truncate text-[10px] font-medium leading-tight text-neutral-500 sm:text-[10.5px]">
          {desc}
        </p>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="h-full w-full text-left"
        aria-label="More quick actions"
      >
        {content}
      </button>
    );
  }

  return (
    <Link to={to} className="block h-full">
      {content}
    </Link>
  );
}

export default function DashboardQuickActions() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <section className="dashboard-card flex h-full flex-col rounded-2xl border border-neutral-100/90 bg-white p-[var(--card-pad)] shadow-xs sm:rounded-2xl">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <IconWell accent="emerald" size="sm">
          <Scan className="h-3.5 w-3.5 stroke-[2.2]" />
        </IconWell>
        <h2 className="truncate text-[13px] font-bold tracking-tight text-neutral-900 sm:text-[13.5px]">
          Quick actions
        </h2>
      </div>

      <div className="mt-2 grid flex-1 auto-rows-fr grid-cols-1 gap-2 md:grid-cols-3 sm:gap-2.5">
        {PRIMARY_ACTIONS.map((item) => (
          <ActionTile
            key={item.to}
            to={item.to}
            label={item.label}
            desc={item.desc}
            icon={item.icon}
            bgClass={item.bgClass}
            wellClass={item.wellClass}
          />
        ))}

        <div className="relative h-full" ref={ref}>
          <ActionTile
            to="#"
            label="More"
            desc="Explore all features"
            icon={<MoreHorizontal className="h-[18px] w-[18px] text-neutral-600 stroke-[2.2]" />}
            bgClass=""
            wellClass="bg-neutral-100 text-neutral-600"
            isDashed
            onClick={() => setOpen((o) => !o)}
          />

          {open && (
            <div
              role="menu"
              aria-label="More quick actions"
              className="absolute bottom-full left-0 z-20 mb-1.5 w-[min(100vw-2rem,220px)] rounded-xl border border-neutral-200/80 bg-white p-1 shadow-lg sm:left-auto sm:right-0 dark:border-neutral-800 dark:bg-neutral-900"
            >
              {MORE_MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <IconWell accent={item.accent} size="sm">
                      <Icon className="h-4 w-4 stroke-[2]" />
                    </IconWell>
                    <span>
                      <span className="block text-[12px] font-bold text-neutral-900 dark:text-white">
                        {item.label}
                      </span>
                      <span className="block text-[10.5px] text-neutral-500">{item.desc}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
