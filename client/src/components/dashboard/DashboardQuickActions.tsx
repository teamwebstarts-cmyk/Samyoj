import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Facebook,
  FileText,
  Hash,
  Instagram,
  LifeBuoy,
  LineChart,
  MessageSquare,
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
import type { WorkspaceChannels } from '../../utils/workspaceChannels';
import {
  dashboardMoreActionKeys,
  dashboardQuickActionKeys,
  type DashboardMoreActionKey,
  type DashboardQuickActionKey,
} from '../../utils/workspaceChannels';

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

const PRIMARY_BY_KEY: Record<DashboardQuickActionKey, Omit<ActionTileProps, 'onClick' | 'isDashed'>> = {
  inbox: {
    to: '/inbox',
    label: 'Open Inbox',
    desc: 'Reply to customers',
    icon: <InboxTileSvg className="h-[18px] w-[18px] text-emerald-600" />,
    bgClass: 'bg-emerald-50/50 border-emerald-100/80 hover:border-emerald-200 hover:bg-emerald-50/80',
    wellClass: 'bg-emerald-100 text-emerald-600',
  },
  campaigns: {
    to: '/campaigns',
    label: 'Create Campaign',
    desc: 'Send messages',
    icon: <CampaignsTileSvg className="h-[18px] w-[18px] text-violet-600" />,
    bgClass: 'bg-violet-50/50 border-violet-100/80 hover:border-violet-200 hover:bg-violet-50/80',
    wellClass: 'bg-violet-100 text-violet-600',
  },
  contacts: {
    to: '/contacts',
    label: 'Manage Contacts',
    desc: 'Manage customers',
    icon: <ContactsSvg className="h-[18px] w-[18px] text-sky-600" />,
    bgClass: 'bg-sky-50/50 border-sky-100/80 hover:border-sky-200 hover:bg-sky-50/80',
    wellClass: 'bg-sky-100 text-sky-600',
  },
  automations: {
    to: '/automations',
    label: 'Set Up Automations',
    desc: 'Auto replies & workflows',
    icon: <AutomationsTileSvg className="h-[18px] w-[18px] text-amber-600" />,
    bgClass: 'bg-amber-50/50 border-amber-100/80 hover:border-amber-200 hover:bg-amber-50/80',
    wellClass: 'bg-amber-100 text-amber-600',
  },
  templates: {
    to: '/templates',
    label: 'Manage Templates',
    desc: 'Approved messages',
    icon: <FileText className="h-[18px] w-[18px] text-rose-600 stroke-[2.2]" />,
    bgClass: 'bg-rose-50/50 border-rose-100/80 hover:border-rose-200 hover:bg-rose-50/80',
    wellClass: 'bg-rose-100 text-rose-600',
  },
  messenger: {
    to: '/facebook/inbox',
    label: 'Messenger',
    desc: 'Page conversations',
    icon: <MessageSquare className="h-[18px] w-[18px] text-[#1877F2] stroke-[2.2]" />,
    bgClass: 'bg-sky-50/50 border-sky-100/80 hover:border-sky-200 hover:bg-sky-50/80',
    wellClass: 'bg-[#1877F2]/10 text-[#1877F2]',
  },
  ads: {
    to: '/facebook/ads',
    label: 'Ads',
    desc: "Meta's numbers",
    icon: <BarChart3 className="h-[18px] w-[18px] text-indigo-600 stroke-[2.2]" />,
    bgClass: 'bg-indigo-50/50 border-indigo-100/80 hover:border-indigo-200 hover:bg-indigo-50/80',
    wellClass: 'bg-indigo-100 text-indigo-600',
  },
  'ig-inbox': {
    to: '/instagram/inbox',
    label: 'IG Inbox',
    desc: 'Instagram Direct',
    icon: <Instagram className="h-[18px] w-[18px] text-[#C13584] stroke-[2.2]" />,
    bgClass: 'bg-rose-50/50 border-rose-100/80 hover:border-rose-200 hover:bg-rose-50/80',
    wellClass: 'bg-[#E4405F]/10 text-[#C13584]',
  },
  'ig-comments': {
    to: '/instagram/comments',
    label: 'Comments',
    desc: 'Public replies',
    icon: <Hash className="h-[18px] w-[18px] text-fuchsia-600 stroke-[2.2]" />,
    bgClass: 'bg-fuchsia-50/50 border-fuchsia-100/80 hover:border-fuchsia-200 hover:bg-fuchsia-50/80',
    wellClass: 'bg-fuchsia-100 text-fuchsia-600',
  },
};

const MORE_BY_KEY: Record<
  DashboardMoreActionKey,
  { to: string; label: string; desc: string; icon: typeof PhoneCall; accent: 'slate' | 'sky' | 'rose' }
> = {
  calls: { to: '/calls', label: 'Calls', desc: 'Voice calling', icon: PhoneCall, accent: 'slate' },
  tickets: { to: '/tickets', label: 'Tickets', desc: 'Support issues', icon: LifeBuoy, accent: 'slate' },
  usage: { to: '/billing?tab=usage', label: 'Usage & Stats', desc: 'Plan & delivery metrics', icon: LineChart, accent: 'slate' },
  messenger: { to: '/facebook/inbox', label: 'Messenger', desc: 'Page conversations', icon: Facebook, accent: 'sky' },
  ads: { to: '/facebook/ads', label: 'Ads', desc: "Meta's numbers", icon: BarChart3, accent: 'sky' },
  'ig-inbox': { to: '/instagram/inbox', label: 'IG Inbox', desc: 'Instagram Direct', icon: Instagram, accent: 'rose' },
  'ig-comments': { to: '/instagram/comments', label: 'Comments', desc: 'Public replies', icon: Hash, accent: 'rose' },
};

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
      className={`group flex h-full items-center gap-1.5 rounded-lg border px-2 py-2 transition hover:shadow-xs sm:gap-2 sm:px-2.5 sm:py-2.5 ${
        isDashed
          ? 'border-dashed border-neutral-300 bg-neutral-50/40 hover:border-neutral-400 hover:bg-neutral-50/80'
          : bgClass
      }`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition group-hover:scale-105 sm:h-8 sm:w-8 ${wellClass}`}
      >
        {icon}
      </div>
      <div className="min-w-0 text-left">
        <p className="truncate text-[10px] font-bold tracking-tight text-neutral-900 sm:text-[10.5px]">
          {label}
        </p>
        <p className="truncate text-[8.5px] font-medium leading-tight text-neutral-500 sm:text-[9px]">
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

export default function DashboardQuickActions({
  channels = { whatsapp: true, facebook: false, instagram: false, email: false },
}: {
  channels?: WorkspaceChannels;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const primary = dashboardQuickActionKeys(channels).map((key) => PRIMARY_BY_KEY[key]);
  const moreItems = dashboardMoreActionKeys(channels).map((key) => MORE_BY_KEY[key]);

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
        <h2 className="truncate text-[12px] font-bold tracking-tight text-neutral-900 sm:text-[12.5px]">
          Quick actions
        </h2>
      </div>

      <div className="mt-2 grid flex-1 auto-rows-fr grid-cols-1 gap-1.5 md:grid-cols-3 sm:gap-2">
        {primary.map((item) => (
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
              {moreItems.map((item) => {
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
