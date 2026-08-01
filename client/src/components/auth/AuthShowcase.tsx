import {
  BadgeCheck,
  BarChart3,
  Bot,
  Handshake,
  Shield,
  Users,
  Zap,
} from 'lucide-react';
import AuthBrand from './AuthBrand';

const featureChips = [
  { icon: Zap, title: 'Smart Automation', sub: 'Save time & effort' },
  { icon: BarChart3, title: 'Real-time Analytics', sub: 'Track what matters' },
  { icon: Users, title: 'Team Collaboration', sub: 'Work together, better' },
];

const trustItems = [
  { icon: Shield, title: 'Secure & Reliable', sub: '256-bit encryption' },
  { icon: Zap, title: 'AI Powered', sub: 'Smarter automation' },
  { icon: Handshake, title: 'Enterprise Ready', sub: '99.9% uptime' },
];

/**
 * Left marketing panel — structured to match the shared login design:
 * header → headline → chips → hero photo with floating cards → trust bar.
 * Hero photo is the girl workspace art; overlays are real UI (not relying on baked-in PNG chrome).
 */
export default function AuthShowcase() {
  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#f3faf6]">
      {/* Soft ambient orbs */}
      <div className="pointer-events-none absolute -left-16 top-24 h-56 w-56 rounded-full bg-whatsapp-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-40 h-40 w-40 rounded-full bg-emerald-300/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-28 left-1/3 h-48 w-48 rounded-full bg-whatsapp-500/10 blur-3xl" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-8 py-7 xl:px-11 xl:py-8">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-4">
          <AuthBrand />
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/95 px-3 py-1.5 shadow-sm">
            <BadgeCheck className="h-3.5 w-3.5 text-whatsapp-600" strokeWidth={2.4} />
            <span className="text-[11px] font-semibold text-neutral-700">
              Official WhatsApp Business Platform
            </span>
          </div>
        </div>

        {/* Headline */}
        <div className="mt-7 max-w-xl shrink-0 xl:mt-8">
          <h2 className="text-[2.05rem] font-extrabold leading-[1.1] tracking-[-0.04em] text-[#0f2744] xl:text-[2.55rem]">
            Turn Conversations{' '}
            <span className="text-whatsapp-600">Into Growth</span>
          </h2>
          <p className="mt-3 max-w-lg text-[14px] font-medium leading-relaxed text-neutral-600 xl:text-[15px]">
            The all-in-one WhatsApp automation &amp; CRM platform to engage, support and grow your
            business.
          </p>
        </div>

        {/* Feature chips */}
        <div className="mt-5 flex shrink-0 flex-wrap gap-2.5">
          {featureChips.map(({ icon: Icon, title, sub }) => (
            <div
              key={title}
              className="flex min-w-[9.5rem] flex-1 items-start gap-2.5 rounded-2xl border border-white/80 bg-white/90 px-3 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-whatsapp-600 ring-1 ring-emerald-100">
                <Icon className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-bold text-[#0f2744]">{title}</span>
                <span className="mt-0.5 block text-[10px] font-medium text-neutral-500">{sub}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Hero photo + floating cards */}
        <div className="relative mt-5 min-h-0 flex-1">
          <div className="absolute inset-0 overflow-hidden rounded-[1.5rem] border border-white/70 shadow-[0_20px_50px_rgba(15,23,42,0.12)] ring-1 ring-emerald-100/60">
            <img
              src="/brand/auth-hero-photo.jpg"
              alt=""
              className="h-full w-full object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b3d2e]/15 via-transparent to-white/10" />
          </div>

          {/* Large WhatsApp accent */}
          <div className="absolute -left-3 bottom-[38%] z-20 hidden h-16 w-16 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_rgba(37,211,102,0.45)] xl:flex">
            <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </div>

          {/* AI Agent card */}
          <div className="absolute left-3 top-[42%] z-20 w-[11.5rem] rounded-2xl border border-white/90 bg-white/95 p-3 shadow-[0_14px_40px_rgba(15,23,42,0.16)] backdrop-blur xl:left-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-whatsapp-600 ring-1 ring-emerald-100">
                <Bot className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-[#0f2744]">AI Agent</p>
                <p className="flex items-center gap-1 text-[10px] font-semibold text-whatsapp-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-whatsapp-500" />
                  Online
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-neutral-100 pt-2.5">
              <div>
                <p className="text-[9px] font-medium text-neutral-500">Handled</p>
                <p className="text-[13px] font-extrabold text-whatsapp-600">1,248</p>
              </div>
              <div>
                <p className="text-[9px] font-medium text-neutral-500">Resolution</p>
                <p className="text-[13px] font-extrabold text-whatsapp-600">98%</p>
              </div>
            </div>
          </div>

          {/* Conversations card */}
          <div className="absolute right-3 top-[28%] z-20 w-[11.25rem] rounded-2xl border border-white/90 bg-white/95 p-3 shadow-[0_14px_40px_rgba(15,23,42,0.16)] backdrop-blur xl:right-5">
            <p className="text-[11px] font-bold text-[#0f2744]">Conversations</p>
            <p className="mt-1 text-[1.65rem] font-extrabold leading-none tracking-tight text-[#2563eb]">
              24.8K
            </p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="text-[10px] font-semibold text-whatsapp-600">
                ↑ 18.6%
                <span className="mt-0.5 block font-medium text-neutral-500">vs last 30 days</span>
              </p>
              <svg viewBox="0 0 64 28" className="h-7 w-14 text-whatsapp-500" aria-hidden>
                <path
                  d="M1 22 C10 20, 14 8, 22 10 S34 24, 42 14 S54 4, 63 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Trust bar */}
        <div className="mt-4 shrink-0 overflow-hidden rounded-2xl border border-white bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="grid grid-cols-3 divide-x divide-neutral-100">
            {trustItems.map(({ icon: Icon, title, sub }) => (
              <div key={title} className="flex items-start gap-2.5 px-3 py-3 xl:px-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-whatsapp-600">
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold leading-tight text-[#0f2744]">
                    {title}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-medium text-neutral-500">{sub}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
