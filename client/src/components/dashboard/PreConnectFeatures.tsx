import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Leaf,
  Lock,
  Send,
  Shield,
  TrendingUp,
  Users,
} from 'lucide-react';

const FEATURES = [
  {
    id: 'automations',
    title: 'Smart Automations',
    description: 'Automate workflows and save valuable time.',
    to: '/automations',
    icon: BadgeCheck,
    well: 'bg-emerald-50 text-emerald-600',
  },
  {
    id: 'bots',
    title: 'AI-Powered Bots',
    description: 'Handle customer queries instantly with AI.',
    to: '/ai-bot',
    icon: Bot,
    well: 'bg-violet-50 text-violet-600',
  },
  {
    id: 'broadcast',
    title: 'Broadcast Campaigns',
    description: 'Send personalized messages to your audience.',
    to: '/campaigns',
    icon: Send,
    well: 'bg-sky-50 text-sky-600',
  },
  {
    id: 'analytics',
    title: 'Real-time Analytics',
    description: 'Track performance and measure growth.',
    to: '/reports',
    icon: TrendingUp,
    well: 'bg-orange-50 text-orange-600',
  },
  {
    id: 'team',
    title: 'Team Collaboration',
    description: 'Work together and manage your team efficiently.',
    to: '/team',
    icon: Users,
    well: 'bg-pink-50 text-pink-600',
  },
] as const;

export default function PreConnectFeatures() {
  return (
    <section id="preconnect-features" aria-label="Powerful features" className="scroll-mt-20">
      {/* Parent shell matching design: heading + cards in one bordered surface */}
      <div className="rounded-2xl border border-neutral-100 bg-[#F8FAFB] p-[var(--card-pad)] shadow-[0_4px_12px_rgba(15,23,42,0.04)] md:rounded-[1.25rem]">
        <div className="max-w-3xl">
          <h3 className="text-[17px] font-bold tracking-tight text-neutral-900 sm:text-[19px]">
            Powerful features to grow your business
          </h3>
          <p className="mt-1 text-[13px] font-medium text-neutral-500 sm:text-[13.5px]">
            Everything you need to connect, engage and convert your customers.
          </p>
        </div>

        <div className="card-grid mt-[var(--card-gap)] grid grid-cols-1 items-stretch min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_minmax(220px,1.55fr)]">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <article
                key={f.id}
                className="flex h-full flex-col rounded-xl border border-neutral-100 bg-white p-3.5 sm:rounded-2xl sm:p-4"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${f.well}`}
                >
                  <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={2.05} />
                </span>
                <h4 className="mt-3 text-[13.5px] font-bold leading-snug text-neutral-900 sm:text-[14px]">
                  {f.title}
                </h4>
                <p className="mt-1.5 min-h-[2.5rem] flex-1 text-[11px] font-medium leading-snug text-neutral-500 sm:min-h-[2.75rem] sm:text-[11.5px]">
                  {f.description}
                </p>
                <Link
                  to={f.to}
                  className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold text-teal-600 transition hover:text-teal-700 sm:text-[13px]"
                >
                  Explore
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                </Link>
              </article>
            );
          })}

          {/* Security — stretches to same row height as feature cards (feature cards unchanged) */}
          <article className="flex h-full min-h-full flex-col items-center justify-between self-stretch rounded-xl border border-neutral-100 bg-white px-4 py-4 text-center sm:rounded-2xl sm:px-5 sm:py-4 min-[480px]:col-span-2 lg:col-span-3 xl:col-span-1">
            <div className="relative mx-auto flex h-[84px] w-[84px] shrink-0 items-center justify-center sm:h-[92px] sm:w-[92px]">
              <span
                className="absolute inset-0 rounded-full bg-emerald-50 ring-1 ring-emerald-100/80"
                aria-hidden
              />
              <span className="absolute -right-0.5 top-1 text-emerald-400/80" aria-hidden>
                <Leaf className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
              </span>
              <span
                className="absolute -left-1 bottom-2 rotate-[-25deg] text-emerald-300/70"
                aria-hidden
              >
                <Leaf className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2} />
              </span>
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_20px_rgba(37,211,102,0.35)] sm:h-16 sm:w-16">
                <Shield className="absolute h-8 w-8 opacity-30 sm:h-9 sm:w-9" strokeWidth={1.5} />
                <Lock className="relative h-5 w-5" strokeWidth={2.4} />
              </span>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center px-1 py-2">
              <p className="text-[13.5px] font-bold leading-snug text-neutral-900 sm:text-[14px]">
                Your data is safe with us
              </p>
              <p className="mt-1.5 max-w-[220px] text-[11px] font-medium leading-snug text-neutral-500 sm:text-[11.5px]">
                Enterprise-grade security with 99.9% uptime guarantee.
              </p>
            </div>

            <Link
              to="/settings?tab=setup"
              className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-[#25D366] transition hover:text-[#1ebe57] sm:text-[13px]"
            >
              Learn more
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
