import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Lock,
  Send,
  ShieldCheck,
  Users,
  Workflow,
} from 'lucide-react';

const FEATURES = [
  {
    id: 'automations',
    title: 'Smart Automations',
    description: 'Trigger replies and workflows without manual effort.',
    to: '/automations',
    icon: Workflow,
    well: 'bg-emerald-50 text-emerald-600',
    link: 'text-[#25D366]',
  },
  {
    id: 'bots',
    title: 'AI-Powered Bots',
    description: 'Handle FAQs and qualify leads with AI assistants.',
    to: '/ai-bot',
    icon: Bot,
    well: 'bg-violet-50 text-violet-600',
    link: 'text-violet-600',
  },
  {
    id: 'broadcast',
    title: 'Broadcast Campaigns',
    description: 'Reach customers at scale with approved templates.',
    to: '/campaigns',
    icon: Send,
    well: 'bg-sky-50 text-sky-600',
    link: 'text-sky-600',
  },
  {
    id: 'analytics',
    title: 'Real-time Analytics',
    description: 'Track delivery, reads and campaign performance live.',
    to: '/reports',
    icon: BarChart3,
    well: 'bg-orange-50 text-orange-600',
    link: 'text-orange-600',
  },
  {
    id: 'team',
    title: 'Team Collaboration',
    description: 'Assign chats and work together in one inbox.',
    to: '/team',
    icon: Users,
    well: 'bg-pink-50 text-pink-600',
    link: 'text-pink-600',
  },
] as const;

export default function PreConnectFeatures() {
  return (
    <section id="preconnect-features" aria-label="Powerful features" className="scroll-mt-20">
      <div className="max-w-2xl">
        <h3 className="text-[16px] font-bold tracking-tight text-neutral-900 sm:text-[18px]">
          Powerful features to grow your business
        </h3>
        <p className="mt-1 text-[13px] font-medium text-neutral-500 sm:text-[13.5px]">
          Everything you need to connect, engage and convert your customers.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_minmax(200px,1.15fr)]">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <article
              key={f.id}
              className="flex h-full flex-col rounded-2xl border border-neutral-100/90 bg-white p-3.5 shadow-[0_4px_12px_rgba(15,23,42,0.05)] sm:p-4"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${f.well}`}>
                <Icon className="h-5 w-5" strokeWidth={2.1} />
              </span>
              <h4 className="mt-3 text-[13.5px] font-bold text-neutral-900 sm:text-[14px]">
                {f.title}
              </h4>
              <p className="mt-1 flex-1 text-[12px] font-medium leading-relaxed text-neutral-500 sm:text-[12.5px]">
                {f.description}
              </p>
              <Link
                to={f.to}
                className={`mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold transition hover:opacity-80 sm:text-[13px] ${f.link}`}
              >
                Explore
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </Link>
            </article>
          );
        })}

        <article className="flex h-full flex-col justify-between rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/90 via-white to-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.05)] min-[480px]:col-span-2 lg:col-span-3 xl:col-span-1">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center xl:flex-col xl:items-start">
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[#25D366]">
              <ShieldCheck className="h-7 w-7" strokeWidth={1.75} />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#25D366] text-white">
                <Lock className="h-3 w-3" strokeWidth={2.5} />
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold leading-snug text-neutral-900 sm:text-[14px]">
                Your data is safe with us.
              </p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-neutral-500 sm:text-[12.5px]">
                Enterprise-grade security with 99.9% uptime guarantee.
              </p>
            </div>
          </div>
          <Link
            to="/settings?tab=setup"
            className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-bold text-[#25D366] transition hover:text-[#1ebe57] sm:text-[13px]"
          >
            Learn more
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </Link>
        </article>
      </div>
    </section>
  );
}
