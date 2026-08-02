import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  FileText,
  LifeBuoy,
  LineChart,
  MessageSquare,
  MoreHorizontal,
  PhoneCall,
  Send,
  Users,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import IconWell, { type IconWellAccent } from './icons/IconWell';

interface ActionItem {
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  accent: IconWellAccent;
}

/** Soft tint wells + outline icons — matches mock (not solid gradient chips). */
const PRIMARY: ActionItem[] = [
  {
    to: '/inbox',
    label: 'Inbox',
    desc: 'Reply to customers',
    icon: MessageSquare,
    accent: 'emerald',
  },
  {
    to: '/campaigns',
    label: 'Campaigns',
    desc: 'Reach your audience',
    icon: Send,
    accent: 'violet',
  },
  {
    to: '/contacts',
    label: 'Contacts',
    desc: 'Customers & pipeline',
    icon: Users,
    accent: 'sky',
  },
  {
    to: '/automations',
    label: 'Automations',
    desc: 'Auto-replies & flows',
    icon: Zap,
    accent: 'amber',
  },
];

const MORE: ActionItem[] = [
  { to: '/templates', label: 'Templates', desc: 'Approved messages', icon: FileText, accent: 'slate' },
  { to: '/calls', label: 'Calls', desc: 'Voice calling', icon: PhoneCall, accent: 'slate' },
  { to: '/tickets', label: 'Tickets', desc: 'Support issues', icon: LifeBuoy, accent: 'slate' },
  { to: '/reports', label: 'Reports', desc: 'Deep analytics', icon: LineChart, accent: 'slate' },
];

function Tile({ item }: { item: ActionItem }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className="group relative overflow-hidden rounded-2xl border border-neutral-100 bg-white p-3.5 transition hover:-translate-y-0.5 hover:shadow-panel sm:p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <IconWell accent={item.accent} size="md">
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </IconWell>
        <ArrowUpRight className="h-4 w-4 text-neutral-300 transition group-hover:text-neutral-500" />
      </div>
      <p className="mt-2.5 text-[13px] font-bold text-neutral-900">{item.label}</p>
      <p className="mt-0.5 text-[11px] font-medium text-neutral-500">{item.desc}</p>
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
    <section>
      <div className="mb-2.5 flex items-end justify-between px-0.5">
        <div>
          <h2 className="text-[14px] font-extrabold tracking-tight text-neutral-900 sm:text-[15px]">
            Quick actions
          </h2>
          <p className="mt-0.5 text-[12px] font-medium text-neutral-500">Jump into your day</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
        {PRIMARY.map((item) => (
          <Tile key={item.to} item={item} />
        ))}
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-panel sm:p-4"
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label="More quick actions"
          >
            <div className="flex items-start justify-between gap-2">
              <IconWell accent="slate" size="md">
                <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
              </IconWell>
              <ArrowUpRight className="h-4 w-4 text-neutral-300" />
            </div>
            <p className="mt-2.5 text-[13px] font-bold text-neutral-900">More</p>
            <p className="mt-0.5 text-[11px] font-medium text-neutral-500">Templates & more</p>
          </button>
          {open && (
            <div
              role="menu"
              aria-label="More quick actions"
              className="absolute bottom-full left-0 z-20 mb-2 w-[min(100%,220px)] rounded-xl border border-neutral-200 bg-white p-1 shadow-lg sm:left-auto sm:right-0"
            >
              {MORE.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition hover:bg-neutral-50"
                  >
                    <IconWell accent={item.accent} size="sm">
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </IconWell>
                    <span>
                      <span className="block text-[12.5px] font-bold text-neutral-900">{item.label}</span>
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
