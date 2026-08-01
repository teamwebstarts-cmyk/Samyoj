import { Cloud, Lock, ShieldCheck } from 'lucide-react';
import type { ComponentType } from 'react';
import AuthBrand from './AuthBrand';
import {
  IconBarChart,
  IconBolt,
  IconChatSmile,
  IconSparkle,
  IconTeam,
  IconTrendUp,
} from './AuthIcons';

type AuthIcon = ComponentType<{ className?: string }>;

const FEATURES: { icon: AuthIcon; title: string; description: string }[] = [
  { icon: IconChatSmile, title: 'Smart Automation', description: 'Save time & effort' },
  { icon: IconBarChart, title: 'Real-time Analytics', description: 'Track what matters' },
  { icon: IconTeam, title: 'Team Collaboration', description: 'Work together, better' },
];

const STATS = [
  { icon: IconChatSmile, value: '24.8K+', label: 'Conversations Handled Daily' },
  { icon: IconTrendUp, value: '98%', label: 'Customer Satisfaction' },
  { icon: IconBolt, value: '1.2s', label: 'Average Response Time' },
];

/** Two sharp four-point stars next to “Into Growth” (design) */
function GrowthSparkles() {
  return (
    <span className="ml-1.5 inline-flex items-start gap-0.5 align-middle" aria-hidden>
      <IconSparkle className="h-[0.72em] w-[0.72em] -translate-y-1 text-[#0A8954]" />
      <IconSparkle className="mt-1 h-[0.42em] w-[0.42em] text-[#22A06B]" />
    </span>
  );
}

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function AuthShowcase() {
  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      {/* Full soft background photo — no hard cutout / vignette mask */}
      <div className="pointer-events-none absolute inset-0">
        <img
          src="/brand/auth-hero.png"
          alt=""
          className="h-full w-full object-cover object-[52%_30%]"
        />
        {/* Soft wash so image reads as atmosphere, not a clipped cutout */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#F7FAF8] from-[0%] via-[#F7FAF8]/92 via-[34%] to-[#F7FAF8]/15 to-[72%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#F7FAF8]/80 via-transparent to-[#F7FAF8]/70" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#F7FAF8] via-[#F7FAF8]/75 to-transparent" />
        <div className="absolute -left-10 top-20 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute right-[18%] top-[20%] h-40 w-40 rounded-full bg-whatsapp-400/25 blur-2xl" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col px-7 pb-4 pt-6 sm:px-8 xl:px-10 xl:pb-5 xl:pt-7">
        <AuthBrand />

        <div className="mt-7 max-w-[min(100%,420px)] xl:mt-8">
          <h2 className="text-[clamp(1.75rem,2.4vw,2.45rem)] font-extrabold leading-[1.1] tracking-[-0.035em] text-slate-900">
            Turn Conversations
            <br />
            <span className="text-[#0A8954]">
              Into Growth
              <GrowthSparkles />
            </span>
          </h2>
          <p className="mt-3 max-w-[380px] text-[clamp(13.5px,1.15vw,15px)] leading-[1.55] text-slate-600">
            The all-in-one WhatsApp automation &amp; CRM platform to engage, support and grow your
            business.
          </p>
        </div>

        <ul className="mt-7 w-full max-w-[min(100%,380px)] space-y-5 xl:mt-8 xl:space-y-6">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex items-center gap-3.5 sm:gap-4">
              <span className="flex h-[3.35rem] w-[3.35rem] shrink-0 items-center justify-center rounded-full bg-white shadow-[0_8px_22px_rgba(15,23,42,0.09)] ring-1 ring-emerald-100/90 sm:h-14 sm:w-14">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F5EE] text-[#0A8954] sm:h-11 sm:w-11">
                  <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
                </span>
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-bold leading-tight text-slate-900 sm:text-[16px]">
                  {title}
                </p>
                <p className="mt-1 text-[13px] font-medium leading-snug text-slate-500 sm:text-[13.5px]">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="relative z-10 mt-auto w-full max-w-[min(100%,480px)] space-y-3 pt-8">
          <div className="rounded-[1.5rem] border border-white/90 bg-white/95 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.1)] backdrop-blur-sm sm:p-6">
            <p className="text-[12px] font-semibold tracking-wide text-slate-500">
              Trusted by 1,000+ businesses
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-3">
              {STATS.map(({ icon: Icon, value, label }, index) => (
                <div
                  key={label}
                  className={`px-1 text-center sm:px-2 ${
                    index > 0 ? 'border-l border-slate-100' : ''
                  }`}
                >
                  <span className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-[#EAF7F0] text-[#0A8954] shadow-[0_2px_8px_rgba(10,137,84,0.08)] sm:h-12 sm:w-12">
                    <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
                  </span>
                  <p className="text-[clamp(15px,1.4vw,18px)] font-extrabold tracking-tight text-[#0A8954]">
                    {value}
                  </p>
                  <p className="mt-1 text-[10px] font-medium leading-snug text-slate-500 sm:text-[11px]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-emerald-50/95 px-3.5 py-2.5 ring-1 ring-emerald-100/70">
            <WhatsAppGlyph className="h-4 w-4 shrink-0 text-[#0A8954]" />
            <span className="text-[11.5px] font-semibold text-emerald-800 sm:text-[12px]">
              Built on the Official WhatsApp Business Platform
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthTopBadge() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3.5 z-30 hidden -translate-x-1/2 lg:flex">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100/90 bg-white/95 px-3.5 py-1.5 shadow-[0_4px_18px_rgba(15,23,42,0.07)] backdrop-blur">
        <ShieldCheck className="h-3.5 w-3.5 text-[#0A8954]" strokeWidth={2.4} />
        <span className="whitespace-nowrap text-[11px] font-semibold text-slate-700">
          Official WhatsApp Business Platform
        </span>
      </div>
    </div>
  );
}

export function AuthTrustFooter() {
  return (
    <div className="relative z-20 w-full px-0">
      <div className="flex w-full items-stretch overflow-hidden rounded-2xl border border-slate-100/90 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
        {/* Meta */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-3 sm:gap-2.5 sm:px-3.5 sm:py-3.5">
          <svg
            viewBox="0 0 36 24"
            className="h-[18px] w-[26px] shrink-0 sm:h-5 sm:w-7"
            aria-hidden
          >
            <path
              fill="#0668E1"
              fillRule="evenodd"
              d="M12.2 4.2c2.15 0 3.95 1.45 5.05 3.55.95-1.85 2.65-3.55 5.05-3.55 3.55 0 6.2 3.15 6.2 7.55 0 4.7-3.05 8.85-7.4 8.85-1.95 0-3.55-.85-4.7-2.2-1.15 1.35-2.75 2.2-4.7 2.2-4.35 0-7.4-4.15-7.4-8.85 0-4.4 2.65-7.55 6.2-7.55zm5.05 9.85c.85 1.85 2.2 2.95 3.75 2.95 2.55 0 4.35-2.45 4.35-5.7 0-2.95-1.55-4.85-3.7-4.85-1.55 0-2.9 1.15-3.75 2.95v4.65h-.65zm-1.65 0V9.4c-.85-1.8-2.2-2.95-3.75-2.95-2.15 0-3.7 1.9-3.7 4.85 0 3.25 1.8 5.7 4.35 5.7 1.55 0 2.9-1.1 3.75-2.95h-.65z"
            />
          </svg>
          <div className="min-w-0 text-left">
            <p className="truncate text-[12px] font-bold leading-tight text-slate-900 sm:text-[12.5px]">
              Meta
            </p>
            <p className="truncate text-[9.5px] font-medium leading-tight text-slate-500 sm:text-[10px]">
              Verified Partner
            </p>
          </div>
        </div>

        <div className="my-2.5 w-px shrink-0 bg-slate-100" />

        {/* Encryption */}
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 sm:gap-2.5 sm:px-3.5 sm:py-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8F5EE] text-[#0A8954]">
            <ShieldCheck className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 text-left">
            <p className="truncate text-[12px] font-bold leading-tight text-slate-900 sm:text-[12.5px]">
              256-bit
            </p>
            <p className="truncate text-[9.5px] font-medium leading-tight text-slate-500 sm:text-[10px]">
              Encryption
            </p>
          </div>
        </div>

        <div className="my-2.5 w-px shrink-0 bg-slate-100" />

        {/* Uptime */}
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 sm:gap-2.5 sm:px-3.5 sm:py-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8F5EE] text-[#0A8954]">
            <Cloud className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 text-left">
            <p className="truncate text-[12px] font-bold leading-tight text-slate-900 sm:text-[12.5px]">
              99.9%
            </p>
            <p className="truncate text-[9.5px] font-medium leading-tight text-slate-500 sm:text-[10px]">
              Uptime
            </p>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-2.5 px-1">
        <span className="h-px max-w-[48px] flex-1 bg-gradient-to-r from-transparent to-emerald-300/70" />
        <p className="flex shrink-0 items-center gap-1.5 text-[10.5px] font-medium text-slate-500 sm:text-[11px]">
          <Lock className="h-3 w-3 text-[#0A8954]" strokeWidth={2.3} />
          Your data is safe with enterprise-grade security
        </p>
        <span className="h-px max-w-[48px] flex-1 bg-gradient-to-l from-transparent to-emerald-300/70" />
      </div>
    </div>
  );
}
