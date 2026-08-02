import { useState, useRef, useEffect, ReactNode } from 'react';
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
    icon: <InboxTileSvg className="h-6 w-6 text-emerald-600" />,
    bgClass: 'bg-emerald-50/40 border-emerald-100/70 hover:border-emerald-200 hover:bg-emerald-50/70',
    wellClass: 'bg-emerald-100/80 text-emerald-600',
  },
  {
    to: '/campaigns',
    label: 'Campaigns',
    desc: 'Send messages to many',
    icon: <CampaignsTileSvg className="h-6 w-6 text-violet-600" />,
    bgClass: 'bg-violet-50/40 border-violet-100/70 hover:border-violet-200 hover:bg-violet-50/70',
    wellClass: 'bg-violet-100/80 text-violet-600',
  },
  {
    to: '/contacts',
    label: 'Contacts',
    desc: 'Manage your customers',
    icon: <ContactsSvg className="h-6 w-6 text-sky-600" />,
    bgClass: 'bg-sky-50/40 border-sky-100/70 hover:border-sky-200 hover:bg-sky-50/70',
    wellClass: 'bg-sky-100/80 text-sky-600',
  },
  {
    to: '/automations',
    label: 'Automations',
    desc: 'Set up auto replies',
    icon: <AutomationsTileSvg className="h-6 w-6 text-amber-600" />,
    bgClass: 'bg-amber-50/40 border-amber-100/70 hover:border-amber-200 hover:bg-amber-50/70',
    wellClass: 'bg-amber-100/80 text-amber-600',
  },
];

const MORE_MENU_ITEMS = [
  {
    to: '/templates',
    label: 'Templates',
    desc: 'Approved messages',
    icon: FileText,
    accent: 'slate' as const,
  },
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
    to: '/reports',
    label: 'Reports',
    desc: 'Deep analytics',
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
      className={`group flex h-full flex-col items-center justify-center text-center p-2.5 sm:p-3.5 md:p-4 rounded-2xl sm:rounded-3xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs ${
        isDashed
          ? 'border-dashed border-neutral-300 bg-neutral-50/30 hover:border-neutral-400 hover:bg-neutral-50/70'
          : bgClass
      }`}
    >
      <div
        className={`flex h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 items-center justify-center rounded-xl sm:rounded-2xl mb-2 sm:mb-3 transition-transform duration-200 group-hover:scale-105 ${wellClass}`}
      >
        {icon}
      </div>

      <p className="line-clamp-1 text-[12px] font-bold tracking-tight text-neutral-900 sm:text-[13px] md:text-[13.5px] xl:text-[14px]">
        {label}
      </p>

      <p className="mt-0.5 line-clamp-2 max-w-[100px] text-[10px] font-medium leading-tight text-neutral-500 sm:mt-1 sm:max-w-[120px] sm:text-[11px] md:text-[11.5px]">
        {desc}
      </p>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left"
        aria-label="More quick actions"
      >
        {content}
      </button>
    );
  }

  return <Link to={to}>{content}</Link>;
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
    <section className="dashboard-card flex flex-col rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 md:p-5 bg-white border border-neutral-100/90 shadow-xs">
      {/* Card Header: Icon + Title + Subtitle */}
      <div className="flex items-center gap-2.5">
        <IconWell accent="emerald" size="sm" round>
          <Scan className="h-4 w-4 stroke-[2.2]" />
        </IconWell>
        <div className="min-w-0">
          <h2 className="text-[14px] sm:text-[15px] md:text-[16px] font-bold text-neutral-900 tracking-tight">
            Quick actions
          </h2>
          <p className="text-[11.5px] sm:text-[12px] font-medium text-neutral-500">
            Jump to what you do most
          </p>
        </div>
      </div>

      {/* 2 → 3 → 5 tiles across breakpoints; no orphan blank cells */}
      <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 md:grid-cols-5 sm:gap-2.5 md:gap-3">
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

        {/* 5th Tile: "More" with Dashed Border */}
        <div className="relative col-span-1" ref={ref}>
          <ActionTile
            to="#"
            label="More"
            desc="Explore all features"
            icon={<MoreHorizontal className="h-5 w-5 sm:h-6 sm:w-6 text-neutral-600 stroke-[2.2]" />}
            bgClass=""
            wellClass="bg-neutral-100 text-neutral-600"
            isDashed
            onClick={() => setOpen((o) => !o)}
          />

          {open && (
            <div
              role="menu"
              aria-label="More quick actions"
              className="absolute bottom-full left-0 z-20 mb-2 w-[min(100vw-2rem,220px)] rounded-2xl border border-neutral-200/80 bg-white p-1.5 shadow-lg sm:left-auto sm:right-0 dark:bg-neutral-900 dark:border-neutral-800"
            >
              {MORE_MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <IconWell accent={item.accent} size="sm">
                      <Icon className="h-4 w-4 stroke-[2]" />
                    </IconWell>
                    <span>
                      <span className="block text-[12.5px] font-bold text-neutral-900 dark:text-white">
                        {item.label}
                      </span>
                      <span className="block text-[11px] text-neutral-500">{item.desc}</span>
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
