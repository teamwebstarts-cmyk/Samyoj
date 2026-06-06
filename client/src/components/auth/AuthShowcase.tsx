import {
  ArrowUpRight,
  BarChart3,
  CheckCheck,
  MessageSquare,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import AuthBrand from './AuthBrand';

const features = [
  { icon: MessageSquare, label: 'Team inbox' },
  { icon: Zap, label: 'Automations' },
  { icon: Send, label: 'Campaigns' },
  { icon: BarChart3, label: 'Analytics' },
];

const avatars = ['SK', 'RM', 'AP', 'JT'];

export default function AuthShowcase() {
  return (
    <div className="relative flex h-full min-h-screen flex-col overflow-hidden bg-[#011a14]">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-whatsapp-900 via-[#022c22] to-[#011a14]" />
      <div className="pointer-events-none absolute inset-0 showcase-grid" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(37,211,102,0.22),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_100%,rgba(18,140,126,0.15),transparent_45%)]" />
      <div className="pointer-events-none absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-whatsapp-500/20 blur-[100px] animate-pulse-soft" />
      <div className="pointer-events-none absolute -right-16 bottom-1/4 h-64 w-64 rounded-full bg-emerald-400/10 blur-[90px] animate-float" />

      <div className="relative flex flex-1 flex-col px-10 py-12 xl:px-14 xl:py-14">
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-up">
          <AuthBrand variant="light" />
          <div className="hidden items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-950/40 px-3 py-1.5 backdrop-blur-md xl:flex">
            <Sparkles className="h-3 w-3 text-amber-300" />
            <span className="text-[11px] font-semibold text-emerald-50">Trusted by 500+ teams</span>
          </div>
        </div>

        {/* Hero copy */}
        <div className="mt-10 max-w-lg animate-fade-up-delay xl:mt-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-900/50 px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">
              Live platform
            </span>
          </div>

          <h2 className="text-[2rem] font-extrabold leading-[1.12] tracking-[-0.035em] text-white xl:text-[2.65rem]">
            Turn every chat into
            <br />
            <span className="showcase-gradient-text">revenue & retention</span>
          </h2>
          <p className="showcase-text-body mt-4 max-w-md text-[15px] leading-relaxed">
            The all-in-one WhatsApp workspace for support, marketing, and sales teams
            who need speed at scale.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {features.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-950/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-100"
              >
                <Icon className="h-3 w-3 shrink-0 text-emerald-300" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Dashboard mock */}
        <div className="relative mt-8 flex-1 animate-fade-up-delay-2 xl:mt-10">
          <div className="pointer-events-none absolute -inset-3 rounded-[2rem] bg-gradient-to-r from-whatsapp-500/20 via-emerald-500/10 to-transparent blur-2xl" />

          <div className="relative overflow-hidden rounded-[1.35rem] border border-emerald-400/20 bg-[#0f2a24] shadow-showcase ring-1 ring-emerald-400/10 backdrop-blur-xl">
            {/* Browser bar */}
            <div className="flex items-center justify-between border-b border-emerald-400/15 bg-emerald-950/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-emerald-950/50 px-3 py-1 ring-1 ring-emerald-400/15">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse-soft" />
                <span className="text-[10px] font-medium text-emerald-100">app.wa-platform.io/inbox</span>
              </div>
            </div>

            <div className="grid grid-cols-[118px_1fr]">
              {/* Sidebar */}
              <aside className="border-r border-emerald-400/10 bg-emerald-950/30 p-3">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-emerald-500/30" />
                  <div className="space-y-1">
                    <div className="h-1.5 w-12 rounded bg-emerald-200/35" />
                    <div className="h-1 w-8 rounded bg-emerald-200/20" />
                  </div>
                </div>
                {[
                  { icon: BarChart3, active: false },
                  { icon: MessageSquare, active: true },
                  { icon: Send, active: false },
                  { icon: Users, active: false },
                ].map(({ icon: Icon, active }, i) => (
                  <div
                    key={i}
                    className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-2 ${
                      active
                        ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30'
                        : 'text-emerald-200/50'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <div
                      className={`h-1 rounded ${active ? 'w-10 bg-emerald-300/60' : 'w-8 bg-emerald-200/20'}`}
                    />
                  </div>
                ))}
              </aside>

              {/* Main content */}
              <div className="p-3.5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-bold text-white">Inbox</p>
                    <p className="showcase-text-muted text-[10px]">24 conversations · 3 unread</p>
                  </div>
                  <span className="rounded-md bg-emerald-500/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-400/25">
                    Live
                  </span>
                </div>

                {/* Chat messages */}
                <div className="space-y-2">
                  <div className="flex justify-start">
                    <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-emerald-950/50 px-3 py-2 ring-1 ring-emerald-400/15">
                      <p className="text-[10px] font-semibold text-emerald-100">Sarah K.</p>
                      <p className="mt-0.5 text-[11px] text-emerald-50">Can I change my delivery slot?</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[78%] rounded-2xl rounded-br-md bg-emerald-700/70 px-3 py-2 ring-1 ring-emerald-400/30">
                      <p className="text-[11px] font-medium text-white">
                        Sure! Rescheduled to tomorrow 2–4 PM ✓
                      </p>
                      <div className="mt-1 flex items-center justify-end gap-1">
                        <CheckCheck className="h-3 w-3 text-emerald-200" />
                        <span className="text-[9px] font-medium text-emerald-100">Delivered</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-emerald-950/50 px-3 py-2 ring-1 ring-emerald-400/10">
                      <p className="text-[11px] text-emerald-50">Perfect, thank you! 🙌</p>
                    </div>
                  </div>
                </div>

                {/* Quick stats row */}
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Open', value: '24' },
                    { label: 'Avg reply', value: '4m' },
                    { label: 'CSAT', value: '4.9' },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-lg bg-emerald-950/40 px-2 py-1.5 text-center ring-1 ring-emerald-400/15"
                    >
                      <p className="text-[11px] font-bold text-white">{value}</p>
                      <p className="showcase-text-subtle text-[8px] uppercase tracking-wide">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Shimmer overlay — reduced so text stays readable */}
            <div className="pointer-events-none absolute inset-0 showcase-shimmer animate-shimmer opacity-20" />
          </div>

          {/* Floating stat card */}
          <div className="absolute -right-2 top-6 animate-float-delayed rounded-xl border border-emerald-400/20 bg-[#0f2a24] px-4 py-3 shadow-showcase backdrop-blur-xl xl:-right-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 ring-1 ring-emerald-400/25">
                <TrendingUp className="h-4 w-4 text-emerald-300" />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-200">
                  Campaign ROI
                </p>
                <p className="text-lg font-extrabold leading-none text-white">+142%</p>
              </div>
            </div>
            <p className="mt-1.5 text-[10px] font-semibold text-emerald-300">↑ vs last month</p>
          </div>
        </div>

        {/* Footer social proof */}
        <div className="mt-8 flex items-center justify-between border-t border-emerald-400/15 pt-6 animate-fade-up-delay-2">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {avatars.map((initials) => (
                <div
                  key={initials}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#022c22] bg-emerald-600 text-[10px] font-bold text-white"
                >
                  {initials}
                </div>
              ))}
            </div>
            <div>
              <p className="text-[12px] font-semibold text-white">500+ teams onboarded</p>
              <p className="showcase-text-muted text-[11px]">Join growing businesses today</p>
            </div>
          </div>
          <div className="showcase-accent hidden items-center gap-1 text-[11px] font-semibold xl:flex">
            Explore product
            <ArrowUpRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
