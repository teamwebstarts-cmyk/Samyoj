import { Cloud, Shield, ShieldCheck } from 'lucide-react';
import authShowcaseHero from '../../assets/auth/auth-showcase-hero.png';
import AuthBrand from './AuthBrand';

const trustItems = [
  { icon: ShieldCheck, label: 'Meta Verified Partner' },
  { icon: Shield, label: '256-bit Encryption' },
  { icon: Cloud, label: '99.9% Uptime' },
];

export default function AuthShowcase() {
  return (
    <aside className="relative flex h-full min-h-screen flex-col overflow-hidden px-8 py-8 xl:px-12 xl:py-10">
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-whatsapp-500/20 blur-[100px]" />
      <div className="pointer-events-none absolute -right-20 bottom-24 h-80 w-80 rounded-full bg-emerald-400/15 blur-[110px]" />
      <div className="pointer-events-none absolute left-1/3 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-whatsapp-500/10 blur-[80px]" />

      <div className="relative flex items-center justify-between gap-4 animate-fade-up">
        <AuthBrand variant="dark" />
        <div className="hidden items-center gap-1.5 rounded-full border border-whatsapp-500/25 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur-md sm:flex">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-whatsapp-500 text-white">
            <ShieldCheck className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
          <span className="text-[11px] font-semibold text-theme-fg">WhatsApp Business API</span>
        </div>
      </div>

      <div className="relative mt-8 max-w-xl shrink-0 animate-fade-up-delay xl:mt-10">
        <h2 className="text-[2rem] font-extrabold leading-[1.12] tracking-[-0.035em] text-theme-fg xl:text-[2.65rem]">
          Manage Conversations.
          <br />
          <span className="text-whatsapp-600">Drive Growth.</span>
        </h2>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-theme-secondary">
          The all-in-one WhatsApp automation &amp; CRM platform for support, sales, and marketing
          teams.
        </p>
      </div>

      <div className="relative mt-6 flex min-h-0 flex-1 items-center justify-center xl:mt-8">
        <div className="pointer-events-none absolute inset-x-8 inset-y-4 rounded-[2.5rem] bg-gradient-to-b from-whatsapp-500/10 via-transparent to-transparent blur-2xl" />
        <img
          src={authShowcaseHero}
          alt="Samyoj dashboard preview with AI agent, WhatsApp automation, and live conversation analytics"
          className="relative z-[1] max-h-full w-full max-w-[560px] object-contain drop-shadow-[0_24px_60px_rgba(15,23,42,0.12)] animate-fade-up"
          width={1254}
          height={1254}
          decoding="async"
        />
      </div>

      <div className="relative mt-4 flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-t border-theme-border/70 pt-5 text-theme-muted">
        {trustItems.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-whatsapp-600" strokeWidth={2.2} />
            <span className="text-[11px] font-semibold tracking-wide text-theme-secondary">
              {label}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
