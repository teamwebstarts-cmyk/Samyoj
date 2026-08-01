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

/** Soft shield with check — trust mark */
function ShieldSecureIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <path
        d="M12 3.2 5.5 5.6v5.3c0 4.15 2.7 7.95 6.5 9.1 3.8-1.15 6.5-4.95 6.5-9.1V5.6L12 3.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m8.7 11.6 2.25 2.25 4.35-4.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AuthShowcase() {
  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      {/* Soft white frost only behind the text column — match “pura” design */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-y-0 left-0 w-[72%] bg-gradient-to-r from-white/80 from-[0%] via-white/45 via-[55%] to-transparent to-[100%]" />
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-white/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-white/55 via-white/20 to-transparent" />
        <div className="absolute left-[4%] top-[12%] h-[58%] w-[48%] rounded-[2.5rem] bg-white/35 blur-2xl" />
        <div className="absolute bottom-[8%] left-[6%] h-40 w-[55%] rounded-full bg-white/40 blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col px-7 pb-4 pt-6 sm:px-8 xl:px-10 xl:pb-5 xl:pt-7">
        <AuthBrand />

        <div className="mt-7 max-w-[min(100%,420px)] xl:mt-8">
          <h2 className="text-[clamp(1.75rem,2.4vw,2.45rem)] font-extrabold leading-[1.1] tracking-[-0.035em] text-slate-900 drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
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
              {/* Single mint circle like the full design mock */}
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E8F5EE] text-[#0A8954] shadow-[0_4px_14px_rgba(10,137,84,0.12)] sm:h-[3.25rem] sm:w-[3.25rem]">
                <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
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
                  <span className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF7F0] text-[#0A8954] shadow-[0_2px_8px_rgba(10,137,84,0.08)] sm:h-14 sm:w-14">
                    <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
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
        <ShieldSecureIcon className="h-3.5 w-3.5 text-[#0A8954]" />
        <span className="whitespace-nowrap text-[11px] font-semibold text-slate-700">
          Official WhatsApp Business Platform
        </span>
      </div>
    </div>
  );
}
