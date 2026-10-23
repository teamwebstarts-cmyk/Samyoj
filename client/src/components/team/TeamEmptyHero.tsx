import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Building2,
  Headset,
  Mail,
  Plus,
  Shield,
  UserPlus,
  Users,
} from 'lucide-react';
import AppButton from '../ui/AppButton';

type TeamEmptyVariant = 'members' | 'departments' | 'invites';

interface TeamEmptyHeroProps {
  variant: TeamEmptyVariant;
  canManage?: boolean;
  onAction: () => void;
}

const config: Record<
  TeamEmptyVariant,
  {
    title: string;
    description: string;
    sidebarLabel: string;
    sidebarHint: string;
    sidebarIcon: LucideIcon;
    chips: { icon: LucideIcon; label: string; tone: string }[];
    steps: { icon: LucideIcon; label: string; tone: string }[];
    cta: string;
    ctaIcon: LucideIcon;
  }
> = {
  members: {
    title: 'Build your support team',
    description:
      'Add teammates so they can reply to customer chats, manage tickets, and collaborate in your inbox.',
    sidebarLabel: 'Team',
    sidebarHint: 'Collaborate on chats',
    sidebarIcon: Headset,
    chips: [
      {
        icon: Shield,
        label: 'Role-based access',
        tone: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300',
      },
      {
        icon: Users,
        label: 'Shared inbox',
        tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
      },
    ],
    steps: [
      {
        icon: UserPlus,
        label: 'Add a teammate',
        tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300',
      },
      {
        icon: Shield,
        label: 'Assign their role',
        tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/35 dark:text-violet-300',
      },
      {
        icon: Headset,
        label: 'Start replying',
        tone: 'bg-sky-50 text-sky-600 dark:bg-sky-950/35 dark:text-sky-300',
      },
    ],
    cta: 'Add your first member',
    ctaIcon: Plus,
  },
  departments: {
    title: 'Organize into departments',
    description:
      'Group agents into Sales, Support, or Billing so you can route chats and filter reports by team.',
    sidebarLabel: 'Departments',
    sidebarHint: 'Route by team',
    sidebarIcon: Building2,
    chips: [
      {
        icon: Users,
        label: 'Member grouping',
        tone: 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300',
      },
      {
        icon: Headset,
        label: 'Inbox routing',
        tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
      },
    ],
    steps: [
      {
        icon: Building2,
        label: 'Create a department',
        tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/35 dark:text-violet-300',
      },
      {
        icon: Users,
        label: 'Assign members',
        tone: 'bg-sky-50 text-sky-600 dark:bg-sky-950/35 dark:text-sky-300',
      },
      {
        icon: Headset,
        label: 'Route conversations',
        tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300',
      },
    ],
    cta: 'Create your first department',
    ctaIcon: Plus,
  },
  invites: {
    title: 'Send your first invite',
    description: 'Choose their role and department — they finish setup when they accept.',
    sidebarLabel: 'Invites',
    sidebarHint: 'Grow your workspace',
    sidebarIcon: Users,
    chips: [
      {
        icon: Shield,
        label: 'Role picked upfront',
        tone: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300',
      },
      {
        icon: Building2,
        label: 'Optional department',
        tone: 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300',
      },
    ],
    steps: [
      {
        icon: Mail,
        label: 'Enter their email',
        tone: 'bg-sky-50 text-sky-600 dark:bg-sky-950/35 dark:text-sky-300',
      },
      {
        icon: Shield,
        label: 'Choose a role',
        tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/35 dark:text-violet-300',
      },
      {
        icon: UserPlus,
        label: 'They join your team',
        tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300',
      },
    ],
    cta: 'Send your first invite',
    ctaIcon: UserPlus,
  },
};

/** 3-step empty hero matching Campaigns, AI Bots, and Contacts. */
export default function TeamEmptyHero({ variant, canManage, onAction }: TeamEmptyHeroProps) {
  const c = config[variant];
  const SidebarIcon = c.sidebarIcon;
  const CtaIcon = c.ctaIcon;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/35 to-violet-50/45 px-4 py-5 shadow-sm dark:border-emerald-900/50 dark:from-slate-950 dark:via-emerald-950/15 dark:to-violet-950/15 sm:px-6 sm:py-6">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-violet-300/15 blur-3xl dark:bg-violet-500/10"
        aria-hidden="true"
      />

      <div className="relative grid items-center gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <div className="hidden rounded-2xl border border-emerald-100 bg-white/75 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-slate-950/60 lg:block">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_8px_20px_rgba(16,185,129,0.22)]">
              <SidebarIcon className="h-5 w-5" strokeWidth={2.1} />
            </span>
            <div>
              <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {c.sidebarHint}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {c.chips.map(({ icon: ChipIcon, label, tone }) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-bold ${tone}`}
              >
                <ChipIcon className="h-3.5 w-3.5" />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="empty-lead text-slate-900 dark:text-white">
            {c.title}
          </h3>
          <p className="mt-1.5 max-w-xl text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400 sm:text-[12px]">
            {c.description}
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {c.steps.map(({ icon: StepIcon, label, tone }, index) => (
              <div
                key={label}
                className="group flex min-h-[62px] items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_8px_20px_rgba(16,185,129,0.10)] dark:border-slate-800/80 dark:bg-slate-950/55 dark:hover:border-emerald-800"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                  <StepIcon className="h-4 w-4" strokeWidth={2.1} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium tabular-nums text-emerald-600 dark:text-emerald-300">
                      0{index + 1}
                    </span>
                    <span className="truncate text-[12px] font-medium text-slate-700 dark:text-slate-200">
                      {label}
                    </span>
                  </span>
                </span>
                {index < 2 && (
                  <ArrowRight className="ml-auto hidden h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-500 sm:block" />
                )}
              </div>
            ))}
          </div>

          {canManage && (
            <AppButton
              className="mt-4 !min-h-9"
              size="sm"
              icon={<CtaIcon className="h-3.5 w-3.5" />}
              onClick={onAction}
            >
              {c.cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </AppButton>
          )}
        </div>
      </div>
    </div>
  );
}
